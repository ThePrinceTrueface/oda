import oda from "../src/index";

/**
 * This example demonstrates how to set up an offline queue.
 * Note: This code is designed for environments with 'window' (Browser/Tauri).
 */
async function offlineDemo() {
  console.log("--- Offline Queue Demo ---");

  const apiClient = oda.http.client("https://api.example.com", {
    defaultTimeout: 5000,
    offlineQueue: {
      // Persistence in localStorage under the key 'oda-queue-my-app'
      storage: oda.helper.localStorage("my-app"),
      // Uses navigator.onLine and 'online' window event
      detector: oda.helper.browserOfflineDetector,
      onError: (req, err) => {
        console.error(`Failed to replay request ${req.method} ${req.url}:`, err);
      },
    },
  });

  console.log("Simulating an offline request...");
  
  // We opt-in to offline queuing for this specific request
  const res = await apiClient.post("/sync", {
    body: { action: "save_data", payload: "important info" },
    config: { offline: true }
  });

  if (res.isInQueue()) {
    console.log("Request enqueued! It will be sent automatically when connectivity returns.");
  } else if (res.isSuccess()) {
    console.log("Request sent successfully (online).");
  } else {
    console.log("Request failed:", res.error());
  }
}

// In a real browser app, you wouldn't need to manually call this, 
// but here is how you could trigger a manual flush:
// (apiClient as any).queue.flush();

offlineDemo().catch(console.error);
