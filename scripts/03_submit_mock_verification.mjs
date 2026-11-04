const body = new URLSearchParams({
  id_cred_pub: "b701d0d6a4f60c1f07f6cc8fb820064048cf2cd923bd7205433d28efc8f844bf",
  endpoint_version: "v1",
  id_cred_pub_signature: "1a5062c08b37365fdec200273391fa45604d2c023bb5ee4c611fbf422237c31d386ba5fc46bc83f335557ff3a8798c8164fd41e6a4c7a08681dd528db51fb402",
  // fail checkbox intentionally omitted (we want success)
  expiry: "2030-01",
  firstName: "John",
  lastName: "Doe",
  sex: "0",
  dob: "19700101",
  countryOfResidence: "DK",
  nationality: "DK",
  idDocType: "1",
  idDocNo: "12345",
  idDocIssuer: "DK",
  idDocIssuedAt: "20200101",
  idDocExpiresAt: "20300101",
  nationalIdNo: "N-1234",
  taxIdNo: "T-1234",
});

const resp = await fetch(
  "https://id-verifier.testnet.concordium.com/api/submit",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  }
);
console.log("status:", resp.status);
console.log("location header:", resp.headers.get("location"));
