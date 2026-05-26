import oda from "../src/index";

async function runMockDemo() {
  console.log("--- Mock Engine Demo ---");

  // 1. Create a mock engine with some rules
  const mock = oda.mock.engine([
    {
      match: "GET /users",
      respond: {
        data: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        status: 200,
      },
    },
    {
      match: "POST /users",
      respond: {
        data: { id: 3, name: "Charlie" },
        status: 201,
      },
      config: { latency: 200 }, // Simulate network delay
    },
    {
      match: "GET /users/*",
      respond: (req) => {
        const id = req.url.split("/").pop();
        return {
          data: { id: Number(id), name: `User ${id}` },
          status: 200,
        };
      },
    },
    {
      match: "GET /error",
      respond: { status: 500, data: { message: "Internal Server Error" } },
    },
  ]);

  // 2. Inject the mock engine into a client
  const api = oda.http.client("https://api.example.com", { engine: mock });

  // 3. Perform requests
  console.log("Fetching users...");
  const usersRes = await api.get("/users");
  if (usersRes.isSuccess()) {
    console.log("Users:", usersRes.data());
  }

  console.log("\nCreating a user (with simulated latency)...");
  const createRes = await api.post("/users", { body: { name: "Charlie" } });
  if (createRes.isSuccess()) {
    console.log("Created:", createRes.data());
  }

  console.log("\nFetching user 42 (dynamic matching)...");
  const user42Res = await api.get("/users/42");
  if (user42Res.isSuccess()) {
    console.log("User 42:", user42Res.data());
  }

  // 4. Assertions / Inspections
  console.log("\n--- Mock History ---");
  console.log("Was /users called?", mock.wasCalled("GET /users"));
  console.log("How many POST calls?", mock.callCount("POST /users"));
  console.log("Last call headers:", mock.calls()[0].request.headers);
}

runMockDemo().catch(console.error);
