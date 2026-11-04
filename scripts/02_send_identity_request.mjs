import fs from "node:fs";

const req = JSON.parse(fs.readFileSync("identity_request.json", "utf8"));
const redirectUri = "http://localhost:9999/confirm-identity";

const params = {
  scope: "identity",
  response_type: "code",
  redirect_uri: redirectUri,
  state: JSON.stringify({ idObjectRequest: req }),
};
const searchParams = new URLSearchParams(params);
const url = `https://id-service.testnet.concordium.com/api/v1/identity?${searchParams.toString()}`;
console.log("URL length:", url.length);

const response = await fetch(url, { redirect: "follow" });
console.log("status:", response.status, "redirected:", response.redirected);
console.log("final URL:", response.url);
const text = await response.text();
console.log("body (first 2000 chars):", text.slice(0, 2000));
