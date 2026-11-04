import { ConcordiumGRPCNodeClient } from "@concordium/web-sdk/nodejs";
import { credentials } from "@grpc/grpc-js";
import { createIdentityRequest } from "@concordium/web-sdk/wasm";
import crypto from "node:crypto";
import fs from "node:fs";

const client = new ConcordiumGRPCNodeClient("grpc.testnet.concordium.com", 20000, credentials.createSsl(), { timeout: 20000 });

async function main() {
  const ipListResp = await fetch("https://wallet-proxy.testnet.concordium.com/v1/ip_info").then((r) => r.json());
  // pick the first IP (the real "Concordium testnet IP")
  const chosen = ipListResp[0];
  console.log("Chosen IP:", chosen.ipInfo.ipDescription);

  const globalContext = await client.getCryptographicParameters();
  console.log("globalContext fetched, genesisString:", globalContext.genesisString);

  // Our own synthetic randomness -- not derived from any real person's data.
  const seed = crypto.randomBytes(64).toString("hex"); // 128 hex chars = 64 bytes, as the HD wallet expects
  fs.writeFileSync("test_identity_seed.hex", seed, { mode: 0o600 });
  console.log("Generated fresh random seed (32 bytes), saved to test_identity_seed.hex (local, not committed anywhere)");

  const arsInfos = chosen.arsInfos;
  const arThreshold = Math.max(1, Object.keys(arsInfos).length - 1); // common convention: n-1 of n

  const input = {
    ipInfo: chosen.ipInfo,
    globalContext,
    arsInfos,
    arThreshold,
    seed,
    net: "Testnet",
    identityIndex: 0,
  };

  const req = createIdentityRequest(input);
  fs.writeFileSync("identity_request.json", JSON.stringify(req));
  console.log("Identity request created. Versioned object keys:", Object.keys(req));
  console.log("v:", req.v);
  console.log("idObjectRequest keys:", Object.keys(req.value || {}));
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exit(1);
});
