import oda from "../src/index";

/**
 * This example shows how to use Oda's built-in mock engine
 * for unit testing without any external testing library.
 */
async function testSuiteDemo() {
  console.log("--- Testing with Oda Mock Engine ---");

  // 1. Setup the mock engine
  const mock = oda.mock.engine([
    {
      match: "POST /login",
      respond: { data: { token: "abc-123" }, status: 200 },
    },
    {
      match: "GET /profile",
      respond: [
        { data: { name: "Alice" }, status: 200 }, // 1st call
        { data: { name: "Alice Updated" }, status: 200 }, // 2nd call
      ],
    }
  ]);

  const client = oda.http.client("https://api.test.com", { engine: mock });

  // --- TEST CASE 1: Verify a call was made ---
  console.log("\n[Test 1] Should call login");
  await client.post("/login", { body: { user: "admin" } });
  
  if (mock.wasCalled("POST /login")) {
    console.log("✅ Success: login was called");
  }

  // --- TEST CASE 2: Check call count ---
  console.log("\n[Test 2] Should call profile twice");
  await client.get("/profile");
  await client.get("/profile");

  const count = mock.callCount("GET /profile");
  if (count === 2) {
    console.log(`✅ Success: profile was called ${count} times`);
  }

  // --- TEST CASE 3: Inspect request payload and headers ---
  console.log("\n[Test 3] Should send correct body to login");
  const loginCalls = mock.calls("POST /login");
  const lastCall = loginCalls[0];
  
  if (lastCall.request.body === JSON.stringify({ user: "admin" })) {
    console.log("✅ Success: correct payload detected");
  }

  // --- TEST CASE 4: Sequential responses ---
  console.log("\n[Test 4] Should return sequential data");
  // We already called it twice, let's reset and call again to see the sequence
  mock.reset();
  
  const res1 = await client.get("/profile");
  const res2 = await client.get("/profile");
  
  console.log("Call 1 data:", (res1.data() as any).name);
  console.log("Call 2 data:", (res2.data() as any).name);

  // --- TEST CASE 5: Resetting state ---
  console.log("\n[Test 5] Should have 0 calls after reset");
  mock.reset();
  if (mock.calls().length === 0) {
    console.log("✅ Success: History cleared");
  }
}

testSuiteDemo().catch(console.error);
