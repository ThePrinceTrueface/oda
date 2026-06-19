import oda from "../src/index";

/**
 * This example demonstrates how to set up an offline queue with per-request callbacks.
 * Note: This code is designed for environments with 'window' (Browser/Tauri).
 */
async function offlineDemo() {
  console.log("--- Offline Queue Demo ---");

  const apiClient = oda.http.client("https://api.example.com", {
    defaultTimeout: 5000,
    offlineQueue: {
      // Persistence in localStorage
      storage: oda.helper.localStorage("my-app"),
      // Connectivity detection
      detector: oda.helper.browserOfflineDetector(),
      onError: (req, err) => {
        console.error(`Failed to replay request ${req.method} ${req.url}:`, err);
      },
      // Global callback called after reconnection
      onSync: (replayed) => {
        console.log(`[Global] Successfully synced ${replayed} requests.`);
      }
    },
  });

  console.log("Simulating an offline request...");
  
  // Opt-in to offline queuing
  const res = await apiClient.post("/sync", {
    body: { action: "save_data", payload: "important info" },
    config: { offline: true }
  });

  if (res.isInQueue()) {
    console.log("Request enqueued!");

    // NEW: Register a per-request callback that triggers when this specific 
    // request is replayed later.
    res.onSync((syncedRes) => {
      if (syncedRes.isSuccess()) {
        console.log("Request successfully synced with data:", syncedRes.data());
      } else {
        console.error("Request failed during sync:", syncedRes.error());
      }
    });

  } else if (res.isSuccess()) {
    console.log("Request sent successfully (online).");
  }
}

offlineDemo().catch(console.error);
