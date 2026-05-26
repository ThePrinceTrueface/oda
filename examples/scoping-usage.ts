import oda from "../src/index";

async function scopingDemo() {
  console.log("--- Scoping & Derivation Demo ---");

  // 1. Root client
  const api = oda.http.client("https://api.myapp.com/v1");

  // 2. Derived client (inherits base path and options)
  const usersApi = api.derivate("/users");
  // Full path: https://api.myapp.com/v1/users

  console.log("Calling derived users API...");
  // GET https://api.myapp.com/v1/users/profile
  await usersApi.get("/profile"); 

  // 3. Scope Enforcement
  try {
    console.log("\nAttempting to call an out-of-scope URL...");
    // This will throw OdaScopeError because it doesn't start with https://api.myapp.com/v1
    await api.get("https://malicious-site.com/steal-token");
  } catch (e: any) {
    console.log("Caught expected error:", e.message);
  }

  // 4. Bypassing scope explicitly
  console.log("\nBypassing scope for an intentional external call (e.g. S3 upload)...");
  const s3Url = "https://my-bucket.s3.amazonaws.com/upload";
  const uploadRes = await api.post(s3Url, {
    body: "file content",
    config: { bypassScope: true }
  });
  
  if (uploadRes.isError()) {
    console.log("Bypass worked (failed with real network error but passed scope assertion).");
  }
}

scopingDemo().catch(console.error);
