# concordium-agent-registry-anchor

A worked example on Concordium's **testnet** CIS-8004 Agent Registry + CIS-8 External Key Registry
— real identity, real account, real contract calls, nothing simulated.

Concordium's own docs frame these standards as answering **who authorized an agent** (a verified
Concordium identity, holding an agent as an NFT). They don't cover **what the agent did
afterward** — that's a separate question this project's `action_ref`/AnchorRegistry pattern answers
on the EVM side. `action-ref/compose.mjs` composes the two: it re-verifies the Concordium side fresh
every run, and only then builds the digest that would be anchored (see
[PROVENANCE.md](PROVENANCE.md#composition-who--what)).

This is our own initiative, unconnected to Concordium's "Trusted Agents Hackathon" — see
[PROVENANCE.md](PROVENANCE.md) for exactly why, what's real vs. disposable test material, and a
real bug we found in Concordium's own tooling along the way.

## What's here

```
scripts/      the 7 steps, in order, from identity request to a registered agent — each one real
verifier/     verify.mjs: re-fetches both transactions from a fresh gRPC query and decodes them
              itself, independent of this repo's saved output and of Concordium's own MCP service
action-ref/   compose.mjs: the WHO (Concordium) + WHAT (action_ref/AnchorRegistry) composition --
              re-verifies fresh, then builds the digest that would be anchored on Base mainnet
PROVENANCE.md full honest account: what's real, what's disposable test material, the bug we found
```

## The flow

1. `scripts/01_create_identity_request.mjs` — synthetic cryptographic identity request (no PII)
2. `scripts/02_send_identity_request.mjs` — sent to the real testnet Identity Provider
3. `scripts/03_submit_mock_verification.mjs` — the IP's own test-mode form, its own default values
4. `scripts/04_create_account.mjs` — builds the credential deployment (account creation)
5. `scripts/05_submit_credential.mjs` — submits it; real account, real tx, finalized on-chain
6. `scripts/06_register_external_key_cis8.mjs` — binds a disposable Ethereum test key to the
   account via CIS-8
7. `scripts/07_register_agent_cis8004.mjs` — registers the agent in CIS-8004 with that binding as
   its `external_reference`

## Verify it yourself

```
node verifier/verify.mjs
```

Re-derives everything from a live Concordium testnet gRPC node — see
[PROVENANCE.md](PROVENANCE.md#independent-re-verification) for exactly what it checks.

## See the composition

```
node action-ref/compose.mjs
```

Re-runs the verifier fresh, then builds (but does not anchor) the WHO+WHAT decision record and its
digest — see [PROVENANCE.md](PROVENANCE.md#composition-who--what).

## Status

Verified end to end; not yet anchored on-chain, not yet published anywhere. See
[PROVENANCE.md](PROVENANCE.md#what-remains-before-this-is-a-complete-published-worked-example).
