import { ConcordiumGRPCNodeClient } from "@concordium/web-sdk/nodejs";
import { credentials } from "@grpc/grpc-js";
import {
  createCredentialPayload,
  signCredentialTransaction,
  getAccountAddress,
} from "@concordium/web-sdk/wasm";
import * as TransactionExpiry from "@concordium/web-sdk/types/TransactionExpiry";
import fs from "node:fs";

const client = new ConcordiumGRPCNodeClient("grpc.testnet.concordium.com", 20000, credentials.createSsl(), { timeout: 20000 });

async function main() {
  const seedAsHex = fs.readFileSync("test_identity_seed.hex", "utf8").trim();
  const ipListResp = await fetch("https://wallet-proxy.testnet.concordium.com/v1/ip_info").then((r) => r.json());
  const chosen = ipListResp[0];
  const globalContext = await client.getCryptographicParameters();
  const idObjectResp = JSON.parse(fs.readFileSync("identity_object.json", "utf8"));
  const idObject = idObjectResp.token.identityObject.value;

  const expiry = TransactionExpiry.fromDate(new Date(Date.now() + 3600_000));

  const input = {
    ipInfo: chosen.ipInfo,
    globalContext,
    arsInfos: chosen.arsInfos,
    idObject,
    revealedAttributes: [],
    credNumber: 0,
    seedAsHex,
    net: "Testnet",
    identityIndex: 0,
  };

  const payload = createCredentialPayload(input, expiry);
  console.log("cred payload keys:", Object.keys(payload));

  // sign
  const { ConcordiumHdWallet } = await import("@concordium/web-sdk/wasm");
  const wallet = ConcordiumHdWallet.fromHex(seedAsHex, "Testnet");
  const signingKey = wallet.getAccountSigningKey(chosen.ipInfo.ipInfo ? chosen.ipInfo.ipInfo.ipIdentity : chosen.ipInfo.ipIdentity, 0, 0).toString("hex");

  const accountAddress = getAccountAddress(payload.credId ?? payload.cdi?.credId ?? payload.unsignedCdi?.credId);
  console.log("Derived account address:", accountAddress.toString());
  fs.writeFileSync("account_address.txt", accountAddress.toString());
  fs.writeFileSync("account_signing_key.hex", signingKey, { mode: 0o600 });

  const signature = await signCredentialTransaction(payload, signingKey);
  console.log("signature:", signature.slice(0, 20), "...");

  fs.writeFileSync("cred_payload.json", JSON.stringify(payload, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  fs.writeFileSync("cred_signature.txt", signature);
  console.log("Saved payload + signature. Not submitting yet -- run submit_credential.mjs next.");
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exit(1);
});
