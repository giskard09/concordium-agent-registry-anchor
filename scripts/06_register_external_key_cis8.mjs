import { ConcordiumGRPCNodeClient } from "@concordium/web-sdk/nodejs";
import { credentials } from "@grpc/grpc-js";
import * as AccountAddress from "@concordium/web-sdk/types/AccountAddress";
import * as ContractAddress from "@concordium/web-sdk/types/ContractAddress";
import * as ReceiveName from "@concordium/web-sdk/types/ReceiveName";
import * as Parameter from "@concordium/web-sdk/types/Parameter";
import * as CcdAmount from "@concordium/web-sdk/types/CcdAmount";
import * as Energy from "@concordium/web-sdk/types/Energy";
import * as TransactionExpiry from "@concordium/web-sdk/types/TransactionExpiry";
import { Transaction } from "@concordium/web-sdk/transactions";
import { buildBasicAccountSigner } from "@concordium/web-sdk";
import fs from "node:fs";

const client = new ConcordiumGRPCNodeClient("grpc.testnet.concordium.com", 20000, credentials.createSsl(), { timeout: 20000 });

function encString(s) {
  const buf = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}
function encBytestring(hex) {
  const buf = Buffer.from(hex, "hex");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

async function main() {
  const namespace = "eip155:8453";
  const keyType = "secp256k1-uncompressed";
  const publicKeyHex = "04bfab283577bc5568c4509e5c3ae10eee1c87431c30f95e8d4084bf667aae58f8e6b3b5bc6b6de3136e821643c8bf4d079169e7d5bce0b38c4c3adc702135236e";
  const scheme = "ethereum-personal-sign";
  const signatureHex = "9043763da919c5c0eada194812ed7ebbaea5386a55f063bfb7db4cb9f64d0cf3307ace5401bf1c1c03d29568bfa72e86e7b7ccf8d5ce77a9ac7865d21b36a1a11c";

  // RegisterExternalKeyParam ::= (external_key: ExternalKeyId) (proof: Proof) (m: Byte^4) (metadata: MetadataEntry^m)
  // ExternalKeyId ::= (namespace: String) (key_type: String) (public_key: Bytestring)
  // Proof ::= (scheme: String) (signature: Bytestring)
  const externalKeyId = Buffer.concat([encString(namespace), encString(keyType), encBytestring(publicKeyHex)]);
  const proof = Buffer.concat([encString(scheme), encBytestring(signatureHex)]);
  const mCount = Buffer.alloc(4); // 0 metadata entries
  const paramBytes = Buffer.concat([externalKeyId, proof, mCount]);
  console.log("param length:", paramBytes.length, "hex:", paramBytes.toString("hex"));

  const senderAddr = AccountAddress.fromBase58(fs.readFileSync("account_address.txt", "utf8").trim());
  const signingKeyHex = fs.readFileSync("account_signing_key.hex", "utf8").trim();

  const nonceResp = await client.getNextAccountNonce(senderAddr);
  console.log("nonce:", nonceResp.nonce.toString());

  const payload = {
    amount: CcdAmount.zero(),
    address: ContractAddress.create(12801n, 0n),
    receiveName: ReceiveName.fromString("CIS-8.registerExternalKey"),
    message: Parameter.fromBuffer(paramBytes),
  };

  const maxEnergy = Energy.create(30000n);
  const expiry = TransactionExpiry.fromDate(new Date(Date.now() + 3600_000));

  const tx = Transaction.updateContract(payload, maxEnergy)
    .addMetadata({ sender: senderAddr, nonce: nonceResp.nonce, expiry })
    .build();

  const signer = buildBasicAccountSigner(signingKeyHex);
  const signed = await Transaction.signAndFinalize(tx, signer);
  const txHash = await client.sendTransaction(signed);
  console.log("submitted tx hash:", txHash.toString());
  fs.writeFileSync("register_external_key_tx.txt", txHash.toString());
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exit(1);
});
