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

async function main() {
  const paramHex = "00000101320000000000000000000000000000000b0000006569703135353a3834353316000000736563703235366b312d756e636f6d707265737365644100000004bfab283577bc5568c4509e5c3ae10eee1c87431c30f95e8d4084bf667aae58f8e6b3b5bc6b6de3136e821643c8bf4d079169e7d5bce0b38c4c3adc702135236e00000000";
  const paramBytes = Buffer.from(paramHex, "hex");
  console.log("param length:", paramBytes.length);

  const senderAddr = AccountAddress.fromBase58(fs.readFileSync("account_address.txt", "utf8").trim());
  const signingKeyHex = fs.readFileSync("account_signing_key.hex", "utf8").trim();

  const nonceResp = await client.getNextAccountNonce(senderAddr);
  console.log("nonce:", nonceResp.nonce.toString());

  const payload = {
    amount: CcdAmount.zero(),
    address: ContractAddress.create(12802n, 0n),
    receiveName: ReceiveName.fromString("CIS-8004.register"),
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
  fs.writeFileSync("register_agent_tx.txt", txHash.toString());
}

main().catch((e) => {
  console.error("ERROR:", e.message || e, e.stack);
  process.exit(1);
});
