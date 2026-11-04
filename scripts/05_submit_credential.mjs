import { ConcordiumGRPCNodeClient } from "@concordium/web-sdk/nodejs";
import { credentials } from "@grpc/grpc-js";
import { serializeCredentialDeploymentPayload } from "@concordium/web-sdk/wasm";
import * as TransactionExpiry from "@concordium/web-sdk/types/TransactionExpiry";
import fs from "node:fs";

const client = new ConcordiumGRPCNodeClient("grpc.testnet.concordium.com", 20000, credentials.createSsl(), { timeout: 20000 });

async function main() {
  const payload = JSON.parse(fs.readFileSync("cred_payload.json", "utf8"));
  const signature = fs.readFileSync("cred_signature.txt", "utf8").trim();

  const raw = serializeCredentialDeploymentPayload([signature], payload);
  console.log("serialized length:", raw.length);

  const expiry = TransactionExpiry.fromEpochSeconds(BigInt(payload.expiry));
  const txHash = await client.sendCredentialDeploymentTransaction(raw, expiry);
  console.log("submitted tx hash:", txHash.toString());
  fs.writeFileSync("credential_tx_hash.txt", txHash.toString());
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exit(1);
});
