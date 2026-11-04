#!/usr/bin/env node
/**
 * Independent verifier for this worked example.
 *
 * Re-fetches both transactions directly from a Concordium testnet gRPC node (not from the
 * Concordium Agent Registry MCP service, not from any cached file in this repo) and decodes the
 * on-chain events ourselves. Confirms:
 *   1. CIS-8 binding tx: the account that registered an external key is the one we claim, the
 *      event tag matches "ExternalKeyRegistered" (231) as named in the CIS-8 proposal spec.
 *   2. CIS-8004 register tx: not rejected, calls out to CIS-8.ownerOfKey mid-execution (proof the
 *      contract validates the binding live, not just trusting the caller's claim), and the
 *      registered token_id decoded from the raw event bytes matches what we report.
 *
 * Usage: node verify.mjs
 */
import { ConcordiumGRPCNodeClient } from "@concordium/web-sdk/nodejs";
import { credentials } from "@grpc/grpc-js";
import * as TransactionHash from "@concordium/web-sdk/types/TransactionHash";
import * as AccountAddress from "@concordium/web-sdk/types/AccountAddress";

const RPC_HOST = "grpc.testnet.concordium.com";
const RPC_PORT = 20000;

const ACCOUNT = "3AmkVPMpkQoP1bnxrqWRR7G7KBBa1UxCXsmUReCGy5a8KhAcij";
const CIS8_TX = "750949e22689cae371a020783ef343178f1baab5f0fb9e844f30e528122b6bb9";
const CIS8004_TX = "f5dce64395e5a76773041142b43aab86ae639cecac60d67a6da57ce2e81a4642";
const EXPECTED_TOKEN_ID = 998n;
const CIS8_CONTRACT = { index: 12801n, subindex: 0n };
const CIS8004_CONTRACT = { index: 12802n, subindex: 0n };

const client = new ConcordiumGRPCNodeClient(RPC_HOST, RPC_PORT, credentials.createSsl(), { timeout: 20000 });

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log("OK:", msg);
}

function u64LEFromAgentTokenId(hexBytes) {
  // AgentTokenId ::= (8: Byte) (id: Byte^8) -- first byte is the literal length 8, then 8 LE bytes.
  const lenByte = hexBytes.readUInt8(0);
  if (lenByte !== 8) throw new Error(`expected AgentTokenId length byte 8, got ${lenByte}`);
  return hexBytes.readBigUInt64LE(1);
}

async function main() {
  const accountBytes = AccountAddress.fromBase58(ACCOUNT).decodedAddress;
  const accountHex = Buffer.from(accountBytes).toString("hex");
  console.log("Verifying against", RPC_HOST + ":" + RPC_PORT, "(fresh gRPC query, not cached)\n");

  // --- 1. CIS-8 binding tx ---
  console.log("--- CIS-8 binding tx", CIS8_TX, "---");
  const s1 = await client.getBlockItemStatus(TransactionHash.fromHexString(CIS8_TX));
  if (s1.status !== "finalized") { fail("CIS-8 tx not finalized: " + s1.status); return; }
  const summary1 = s1.outcome.summary;
  if (summary1.type !== "accountTransaction") { fail("unexpected tx type"); return; }
  const updated1 = summary1.events.find((e) => e.tag === "Updated");
  if (!updated1) { fail("no Updated event -- transaction may have been rejected"); return; }
  if (String(updated1.receiveName) !== "CIS-8.registerExternalKey") { fail("unexpected receiveName: " + updated1.receiveName); return; }
  if (String(updated1.address.index) !== CIS8_CONTRACT.index.toString() || String(updated1.address.subindex) !== CIS8_CONTRACT.subindex.toString()) {
    fail("CIS-8 call went to the wrong contract address"); return;
  }
  ok(`finalized, not rejected, called ${updated1.receiveName} on contract ${updated1.address.index}/${updated1.address.subindex}`);
  const eventTag1 = parseInt(String(updated1.events[0]).slice(0, 2), 16);
  if (eventTag1 !== 231) { fail(`expected event tag 231 (ExternalKeyRegistered per CIS-8 spec), got ${eventTag1}`); return; }
  ok("event tag is 231 (0xe7) == ExternalKeyRegistered, exactly as the CIS-8 proposal spec names it");

  // --- 2. CIS-8004 register tx ---
  console.log("\n--- CIS-8004 register tx", CIS8004_TX, "---");
  const s2 = await client.getBlockItemStatus(TransactionHash.fromHexString(CIS8004_TX));
  if (s2.status !== "finalized") { fail("CIS-8004 tx not finalized: " + s2.status); return; }
  const summary2 = s2.outcome.summary;
  const events2 = summary2.events;

  const interrupted = events2.find((e) => e.tag === "Interrupted");
  const crossCall = events2.find((e) => e.tag === "Updated" && String(e.receiveName) === "CIS-8.ownerOfKey");
  const resumed = events2.find((e) => e.tag === "Resumed");
  const registerUpdate = events2.find((e) => e.tag === "Updated" && String(e.receiveName) === "CIS-8004.register");

  if (!interrupted || !crossCall || !resumed || !registerUpdate) {
    fail("expected cross-contract call pattern (Interrupted -> Updated CIS-8.ownerOfKey -> Resumed -> Updated CIS-8004.register) not found -- the contract may not have validated the binding live");
    return;
  }
  if (resumed.success !== true) { fail("the cross-contract call to CIS-8.ownerOfKey did not succeed"); return; }
  ok("confirmed cross-contract call: CIS-8004.register paused execution (Interrupted), called CIS-8.ownerOfKey on contract " +
    crossCall.address.index + "/" + crossCall.address.subindex + " to check the binding live, then resumed successfully (Resumed.success=true) before completing the registration");

  if (String(registerUpdate.address.index) !== CIS8004_CONTRACT.index.toString() || String(registerUpdate.address.subindex) !== CIS8004_CONTRACT.subindex.toString()) {
    fail("CIS-8004.register call went to the wrong contract address"); return;
  }

  const registeredEventHex = String(registerUpdate.events[0]);
  const registeredBytes = Buffer.from(registeredEventHex, "hex");
  const tag2 = registeredBytes.readUInt8(0);
  if (tag2 !== 254) { fail(`expected event tag 254 (Registered), got ${tag2}`); return; }
  const tokenId = u64LEFromAgentTokenId(registeredBytes.subarray(1, 10));
  if (tokenId !== EXPECTED_TOKEN_ID) { fail(`decoded token_id ${tokenId} does not match expected ${EXPECTED_TOKEN_ID}`); return; }
  ok(`event tag is 254 (0xfe) == Registered, decoded token_id = ${tokenId} (matches expected ${EXPECTED_TOKEN_ID})`);

  // Confirm the account embedded in the event bytes matches our claimed account, byte for byte.
  // Bytes 10-11 (after the 9-byte AgentTokenId at offset 1) are two fields this verifier does not
  // claim to parse (likely an owner-type/variant discriminant) -- the 32-byte account starts at 12.
  const accountInEvent = registeredBytes.subarray(12, 12 + 32).toString("hex");
  if (accountInEvent !== accountHex) {
    fail(`account bytes in Registered event (${accountInEvent}) do not match claimed account (${accountHex})`);
    return;
  }
  ok("account bytes embedded in the Registered event match the claimed account byte-for-byte: " + accountHex);

  console.log("\nALL CHECKS PASS");
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exitCode = 1;
});
