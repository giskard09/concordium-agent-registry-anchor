# Provenance

This is our own worked example, built independently. We are not participants in Concordium's
"Trusted Agents Hackathon" (Concordium + Encode Club, launched 2026-11-03) — that decision was made
explicitly with the creador beforehand (see internal log, 2026-11-03). Nothing here was requested
by Concordium or Encode Club, and this has not been shown to them.

## What this shows

Two layers that answer different questions about the same agent:

- **WHO authorized it** — Concordium's CIS-8004 (Agent Registry) + CIS-8 (External Key Registry),
  real contracts on Concordium **TESTNET**, interacted with for real, not simulated.
- **WHAT it did** — this project's own `action_ref` / AnchorRegistry pattern (same one used in
  `turnkey-action-ref-anchor`, `dapr-history-anchor`, `lightning-wavelength-action-ref-anchor`,
  `flashprove-action-ref-anchor`) answers this on the EVM side. See
  "Composition: WHO + WHAT" below.

Framing: these are two halves of the same picture, not a claim that we "close a gap" in
Concordium's design. CIS-8004/CIS-8 were never meant to answer the second question, and we read
their own docs before writing a line of code here, specifically to confirm that.

## Everything is disposable test material

- **Concordium testnet account** `3AmkVPMpkQoP1bnxrqWRR7G7KBBa1UxCXsmUReCGy5a8KhAcij` — created
  fresh for this worked example (see "Identity and account creation" below). Not connected to any
  other identity we hold.
- **Ethereum test key** `0x88A64D39837CFBF68100B21a26335c44EBAff617` — generated fresh with
  `ethers.Wallet.createRandom()` for this worked example only. **This is not, and must never be
  confused with, our real agentId 59266 key** (ERC-8004 IdentityRegistry, Base mainnet). The
  private key is not in this repository.
- Both are testnet/test-only; no real-world value is attached to either.

## Identity and account creation (fully real, fully disposable)

Concordium requires an identity, even on testnet — there is no bare keypair-plus-faucet path like
an EVM testnet. We went through the real flow end to end:

1. **Identity request**: built with `@concordium/web-sdk`'s `createIdentityRequest`, from a fresh
   random 64-byte seed generated for this example (`scripts/01_create_identity_request.mjs`). This
   object is purely cryptographic (commitments, proofs of knowledge) — it carries no personal data.
2. **Sent to the real testnet Identity Provider** (`id-service.testnet.concordium.com`,
   `scripts/02_send_identity_request.mjs`), which redirected to a verification form at
   `id-verifier.testnet.concordium.com`. That form's own HTML contains this comment, verbatim:
   > "The attribute form that the user is forwarded to, where the attributes can be filled out for
   > testing. In the real world scenario the attributes will be derived from the identity
   > verification process."

   Its fields arrive **pre-filled by the service itself** with generic placeholders (`firstName:
   John`, `lastName: Doe`, `dob: 19700101`, `countryOfResidence: DK`, `idDocNo: 12345`,
   `nationalIdNo: N-1234`, `taxIdNo: T-1234`). We submitted exactly those default values —
   `scripts/03_submit_mock_verification.mjs`. No real person's data was used or fabricated to look
   real; these are the test service's own stock values.
3. **Identity object issued immediately** (`status: done` on the first poll — no real verification
   latency, confirming the mock/test nature of the testnet IP).
4. **Credential deployment** (the transaction that actually creates the on-chain account) built and
   signed from the same seed (`scripts/04_create_account.mjs`), submitted
   (`scripts/05_submit_credential.mjs`):
   - tx: `513c7f19d3923541dffc06543237be26878c2cf8842afc2dda52eada39da21c8`
   - block: `d11c16e738cc7f92a0af6b32234bc80b8d2bfb9279342dca64bfbee0742c2605`
   - resulting account: `3AmkVPMpkQoP1bnxrqWRR7G7KBBa1UxCXsmUReCGy5a8KhAcij` (account index 19352)
5. **Funded via the testnet faucet** (`wallet-proxy.testnet.concordium.com/v0/testnetGTUDrop`,
   submission `c06a5bb9ff85e1e6cf07c7cdd286877dc4ec5ce0c9f4c3a6164dd9d9d8f4fc56`): balance confirmed
   20,000,000,000 μCCD (20,000 CCD, testnet) by a direct `getAccountInfo` query afterward.

## Contracts (testnet) — verified two ways before use

We did not take any contract address on faith. For both CIS-8004 and CIS-8, we (a) queried the
official Concordium Agent Registry MCP service (`agent-registry-mcp.concordium.com/mcp`,
`contract_info` tool) and (b) independently queried the raw chain ourselves
(`getInstanceInfo` via `@concordium/web-sdk`) — both agreed, including the module reference
matching byte for byte.

| | Index/Subindex | Module reference | Entrypoints confirmed live on-chain |
|---|---|---|---|
| CIS-8004 (Agent Registry) | `12802` / `0` | `142462ff638f53b7bbeae8911d23579ed23e5e3c7e9a0353606019628121a5c6` | register, revoke, setAgentURI, setMetadata, setAgentWallet, transfer, updateOperator, upgrade, setExternalRegistries, setExternalReference, transferAdmin, getAdmin, getAgentWallet, getAgentWalletNonce, getMetadata, operatorOf, balanceOf, agentOf, agentByExternalReference, tokenMetadata, supports |
| CIS-8 (External Key Registry) | `12801` / `0` | `3236c12fade1b559935906df2e0e43a372234eac5d40599d6e6cb12cdd6b9afd` | registerExternalKey, revoke, updateMetadata, ownerOfKey, view, getAdmin, transferAdmin, migrate, upgrade, supports |

Genesis hash (testnet): `4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796`.

**Correction we made along the way**: the docs page at `docs.concordium.com` names the CIS-8
entrypoint for registering an external key as `register`. The real, live contract names it
`registerExternalKey` — confirmed by our own `getInstanceInfo` call. We used the real name.

## CIS-8 binding: Ethereum test key → Concordium test account

Canonical bytes built via the official MCP service's `build_cis8_canonical_bytes` tool (prefix
`CIS-8/v1/canonical`, 249 bytes for the final attempt — see "A real bug we found" below for why
there was an earlier, wrong attempt), signed with the Ethereum test key via `ethereum-personal-sign`
(ethers.js `wallet.signMessage`), submitted as a raw `CIS-8.registerExternalKey` contract call built
by hand from the CIS-8 proposal spec's binary parameter layout (`scripts/06_register_external_key_cis8.mjs`):

- External key: namespace `eip155:8453`, key_type `secp256k1-uncompressed`, public key
  `04bfab283577bc5568c4509e5c3ae10eee1c87431c30f95e8d4084bf667aae58f8e6b3b5bc6b6de3136e821643c8bf4d079169e7d5bce0b38c4c3adc702135236e`
  (the real uncompressed secp256k1 public key corresponding to `0x88A64D39837CFBF68100B21a26335c44EBAff617` — **not the 20-byte address**; see the bug note below for why that distinction mattered)
- tx: `750949e22689cae371a020783ef343178f1baab5f0fb9e844f30e528122b6bb9`
- block: `5de91bb434f77ce9ef199d8e100f2cafdcdcdbc6fa898f9a8a3af041006e222a`
- Event emitted: tag `231` (`0xe7`) — matches `ExternalKeyRegistered` exactly as named in the CIS-8
  proposal spec (`proposals.concordium.com/CIS/cis-8.html`).
- Confirmed afterward via the official MCP service's `owner_of_key` tool: owner resolves to our
  test account, status `Active`.

## CIS-8004 registration: the agent, with that binding as its external_reference

Built via the official MCP service's `build_register` tool (this one worked correctly — the naming
bug below is specific to CIS-8's tooling, not CIS-8004's), submitted as a raw `CIS-8004.register`
contract call (`scripts/07_register_agent_cis8004.mjs`):

- tx: `f5dce64395e5a76773041142b43aab86ae639cecac60d67a6da57ce2e81a4642`
- block: `b595da5c32e58a0a097e28c67a257cd722148f8b081aa06b50d01d70106bb9ec`
- Resulting agent: token_id `998`, token_address `JyP9YE9hRnZ7H2aBxHSYU`, owner = our test account,
  external_reference → the CIS-8 binding above, status `Active`.

**The on-chain events show the contract validating the binding live, not trusting our claim**:
`CIS-8004.register` interrupts its own execution, makes a cross-contract call to
`CIS-8.ownerOfKey` on the CIS-8 contract, resumes only after that call succeeds, and only then
completes the registration. `verifier/verify.mjs` checks for this exact pattern
(`Interrupted` → `Updated` on `CIS-8.ownerOfKey` → `Resumed` with `success: true` → `Updated` on
`CIS-8004.register`) — not just that the final transaction succeeded.

## A real bug we found (not fixed by us, not yet reported externally)

The official MCP service's `build_cis8_register` tool is broken: calling it with any input fails
with `encoding chain parameter failed: register param schema: NoReceiveInContract`. The cause,
worked out while debugging: the tool tries to resolve a receive function literally named `register`
on the CIS-8 contract — which does not exist; the real entrypoint is `registerExternalKey`. We
never got `build_cis8_register` to work, for any input. We bypassed it and built the parameter
bytes ourselves from the CIS-8 proposal spec's binary layout (see
`scripts/06_register_external_key_cis8.mjs`).

This was found incidentally while building honestly, not sought out, and is not reported anywhere
outside this repository yet — holding it until we decide whether/how to show this worked example to
anyone, per standing team process for how we handle findings about other projects' infrastructure.

We also note, separately: our first attempt at the CIS-8 binding used the Ethereum test key's
20-byte **address** as the "public key" field, by analogy with how Ethereum identity is usually
represented. The CIS-8 proposal spec is explicit that this field is the raw secp256k1 public key
(33 or 65 bytes), not an address — our first attempt would have been accepted by the MCP tool's
schema (it doesn't validate length against key_type) but was never submitted on-chain; we caught
this by reading the spec before signing, not by a failed transaction.

## Independent re-verification

`verifier/verify.mjs` re-fetches both transactions directly from a Concordium testnet gRPC node —
not from this repository's saved output, not from the MCP service — and decodes the raw on-chain
events itself:

```
node verifier/verify.mjs
```

Checks performed: both transactions finalized and not rejected; correct contract addresses and
receive names; the CIS-8 event's tag matches `ExternalKeyRegistered` (231) per the proposal spec;
the CIS-8004 call's event sequence shows the live cross-contract validation described above; the
registered token_id (998) and the account bytes embedded in the `Registered` event match what this
document claims, byte for byte. Output: `ALL CHECKS PASS`.

## Composition: WHO + WHAT

`action-ref/compose.mjs` is the composition layer, and it is deliberately small:

1. It shells out to `verifier/verify.mjs` fresh, every run — it does not trust a cached result, its
   own prior run, or anything saved in this repo. If that independent re-verification does not pass,
   it refuses outright and writes no record.
2. Only if it passes does it build a decision record: the WHO data above (agent 998, its CIS-8
   binding, both tx hashes), a `decision` field (`proceed`, since the gate passed), and a UTC
   timestamp.
3. It hashes that record (canonical JSON, keys sorted recursively, SHA-256) to produce a digest —
   the value that would be anchored in `AnchorRegistry.anchor(bytes32)` on Base mainnet, same
   contract as every prior worked example in this project.

**What this record deliberately does NOT claim**: that the agent executed a task, moved funds, or
did anything beyond existing as a verified, Active registration with a valid external-key binding.
A testnet identity registration — mock-verified, as documented above — cannot honestly support a
claim heavier than that. Overclaiming here (e.g., pretending this gates a real payment or tool
call) would be exactly the kind of dramatized downstream action we were careful to avoid in the
FlashProve worked example's layer 2, and the same discipline applies here.

A sample run's output (reproducible — the digest changes each run because the record includes a
fresh timestamp; this is the same behavior as every other action_ref in this project):

```
$ node action-ref/compose.mjs
Re-verifying the WHO record against the live Concordium testnet chain (not cached)...
[... verify.mjs output, ALL CHECKS PASS ...]
decision: "proceed"
digest_sha256: 092aaeb2725b355ca49bab7358cec9a8aae3d54c7fa08ee7d7c7b7d7f9e37288
```

**Anchored, with the creador's explicit confirmation.** Digest
`092aaeb2725b355ca49bab7358cec9a8aae3d54c7fa08ee7d7c7b7d7f9e37288` anchored via `giskard-signer`'s
`queue_anchor` (owner wallet key never left the vault):

- tx: `0x6952def39fe2b07d75a9e4bc07abb36effc6ad64229a84e228cdf71893268a53`
- block: `53511499`, Base mainnet (chain 8453)

Verified independently against public RPC (`eth_getTransactionReceipt` +
`eth_getTransactionByHash`, `mainnet.base.org`), not taken from the signer's own report: status
`0x1`, `to` is the AnchorRegistry contract (`0x49fEcA52bC634a9Ab773226D16619deC547794aa`), the
`Anchored` event's digest topic (`0x092aaeb2725b355ca49bab7358cec9a8aae3d54c7fa08ee7d7c7b7d7f9e37288`)
matches the anchored digest exactly byte-for-byte, `from` is the owner wallet
(`0xDcc84E9798E8eB1b1b48A31B8f35e5AA7b83DBF4`), `value` is `0x0` (permissionless anchor, no value
moved).

## What remains before this is a complete, published worked example

1. **Publication venue**: not decided by this session. This repository has not been shown to
   anyone outside the team, and should not be, until that decision is made elsewhere.
