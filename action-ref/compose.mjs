#!/usr/bin/env node
/**
 * Composition layer: WHO (Concordium CIS-8004/CIS-8, verified by ../verifier/verify.mjs) +
 * WHAT (this project's action_ref/AnchorRegistry pattern, EVM side).
 *
 * This is OUR code, not Concordium's. It does not re-implement or trust-replace
 * verifier/verify.mjs -- it SHELLS OUT to it fresh, on every run, and only builds a decision
 * record if that independent re-verification passes. This mirrors the gate pattern already used
 * in flashprove-action-ref-anchor/layer2-action-ref/agent_decision.py: a named, modest decision
 * (proceed/refuse), never a dramatized or overclaimed downstream effect.
 *
 * What this script does NOT do: broadcast anything. It only computes the digest that would be
 * anchored. Broadcasting (AnchorRegistry.anchor(bytes32) on Base mainnet) is a separate, explicit
 * step -- same standing rule as every other worked example in this project.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERIFIER = path.join(__dirname, "..", "verifier", "verify.mjs");

const WHO_RECORD = {
  chain: "concordium",
  network: "testnet",
  genesis_hash: "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796",
  cis8004_contract: { index: 12802, subindex: 0 },
  cis8_contract: { index: 12801, subindex: 0 },
  agent: {
    token_id: 998,
    token_address: "JyP9YE9hRnZ7H2aBxHSYU",
    owner_account: "3AmkVPMpkQoP1bnxrqWRR7G7KBBa1UxCXsmUReCGy5a8KhAcij",
    status: "Active",
  },
  external_reference: {
    kind: "Cis8",
    namespace: "eip155:8453",
    key_type: "secp256k1-uncompressed",
    public_key_hex: "04bfab283577bc5568c4509e5c3ae10eee1c87431c30f95e8d4084bf667aae58f8e6b3b5bc6b6de3136e821643c8bf4d079169e7d5bce0b38c4c3adc702135236e",
  },
  on_chain_evidence: {
    cis8_register_tx: "750949e22689cae371a020783ef343178f1baab5f0fb9e844f30e528122b6bb9",
    cis8004_register_tx: "f5dce64395e5a76773041142b43aab86ae639cecac60d67a6da57ce2e81a4642",
  },
};

function runVerifier() {
  try {
    const out = execFileSync("node", [VERIFIER], { encoding: "utf8", cwd: path.dirname(VERIFIER) });
    return { ok: out.includes("ALL CHECKS PASS"), output: out };
  } catch (e) {
    return { ok: false, output: (e.stdout || "") + (e.stderr || e.message) };
  }
}

function decide(verifierOk) {
  return {
    decision: verifierOk ? "proceed" : "refuse",
    gate: {
      independent_concordium_reverification_passed: verifierOk,
    },
  };
}

function buildActionRecord(decision) {
  const record = {
    action_ref_version: "v1",
    composition: "concordium-cis8004-who + action_ref-what",
    who: WHO_RECORD,
    decision: decision.decision,
    gate: decision.gate,
    note:
      decision.decision === "proceed"
        ? "The WHO record (Concordium CIS-8004 agent 998, CIS-8 binding) was independently re-verified against the live testnet chain immediately before this record was built. This record does not claim the agent DID anything beyond existing, verified, as registered -- that claim is deliberately modest, matching what a testnet identity registration can honestly support."
        : "Independent re-verification of the WHO record failed or could not be completed. No action record is being anchored.",
    decided_at_utc: new Date().toISOString(),
  };
  // Stable canonical serialization: sort all keys recursively before hashing.
  const canonical = JSON.stringify(sortKeysDeep(record));
  record.digest_sha256 = createHash("sha256").update(canonical).digest("hex");
  record._canonical_json = canonical;
  return record;
}

function sortKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeysDeep(obj[k])]));
  }
  return obj;
}

function main() {
  console.log("Re-verifying the WHO record against the live Concordium testnet chain (not cached)...\n");
  const { ok, output } = runVerifier();
  console.log(output);

  const decision = decide(ok);
  const record = buildActionRecord(decision);

  console.log("--- action_ref decision record ---");
  console.log(JSON.stringify({ ...record, _canonical_json: undefined }, null, 2));
  console.log("\ndigest_sha256 (what would be anchored in AnchorRegistry, pending separate explicit confirmation):");
  console.log(record.digest_sha256);

  fs.writeFileSync(path.join(__dirname, "decision.json"), JSON.stringify(record, null, 2));
  console.log("\nSaved to action-ref/decision.json. NOT broadcast -- anchoring needs its own explicit go-ahead.");

  process.exitCode = decision.decision === "proceed" ? 0 : 1;
}

main();
