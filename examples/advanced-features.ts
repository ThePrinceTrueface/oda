import oda from "../src/index";
import { OdaEngine } from "../src/engine";

/**
 * Custom logging engine wrapper.
 */
const loggingEngine: OdaEngine = {
  async execute(request) {
    console.log(`[Request] ${request.method} ${request.url}`);
    const startTime = Date.now();
    
    // Delegate to the real fetch engine
    const response = await oda.http.client("", { engine: undefined }).get(""); // simplified delegation
    // Better way: use fetchEngine directly
    const realResponse = await (oda as any).fetchEngine.execute(request); 
    
    const duration = Date.now() - startTime;
    console.log(`[Response] ${realResponse.status} (${duration}ms)`);
    
    return realResponse;
  }
};

async function advancedDemo() {
  console.log("--- Advanced Features Demo ---");

  // 1. Setting a global engine for all clients
  // oda.setEngine(loggingEngine);

  // 2. Client with default timeout
  const api = oda.http.client("https://jsonplaceholder.typicode.com", {
    defaultTimeout: 1000,
  });

  // 3. Overriding timeout per request
  console.log("Request with custom 5s timeout...");
  await api.get("/posts/1", {
    config: { timeout: 5000 }
  });

  // 4. Using AbortSignal for manual cancellation
  console.log("\nManual cancellation demo...");
  const controller = new AbortController();
  
  const requestPromise = api.get("/posts/2", {
    config: { signal: controller.signal }
  });

  // Cancel immediately
  controller.abort("User changed page");

  const res = await requestPromise;
  if (res.isError()) {
    console.log("Request was aborted:", res.error()?.message);
  }

  // 5. Query parameter serialization
  console.log("\nQuery parameter demo...");
  const searchRes = await api.get("/comments", {
    query: {
      postId: 1,
      tags: ["news", "tech"],
      published: true
    }
  });
  // URL: https://jsonplaceholder.typicode.com/comments?postId=1&tags=news&tags=tech&published=true
  console.log("Query status:", searchRes.status());
}

advancedDemo().catch(console.error);
