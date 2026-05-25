import oda from '../src/index';

// Simulation d'une API de placeholder
const api = oda.http.client("https://jsonplaceholder.typicode.com");

async function demo() {
  console.log("🚀 Démarrage de l'exemple oda...");

  // 1. Test d'une requête GET simple
  console.log("\n--- Test GET ---");
  const res = await api.get<any>("/posts/1");

  if (res.isSuccess()) {
    console.log("✅ Succès ! Données reçues :");
    console.log(res.data());
  } else {
    console.log("❌ Erreur :", res.error()?.message);
  }

  // 2. Test des clients dérivés (Sub-clients)
  console.log("\n--- Test Client Dérivé (/posts) ---");
  const postsApi = api.derivate("/posts");
  const newPost = await postsApi.post("/", {
    body: {
      title: 'Mon nouvel article',
      body: 'Contenu de l\'article',
      userId: 1,
    }
  });

  if (newPost.isSuccess()) {
    console.log("✅ Post créé avec succès ! ID:", newPost.data().id);
  }

  // 3. Test de la gestion d'erreur (404)
  console.log("\n--- Test Erreur 404 ---");
  const errorRes = await api.get("/page-inexistante");
  if (errorRes.isError()) {
    console.log("✅ Erreur détectée correctement (c'est normal) :");
    console.log(`Status: ${errorRes.status()} - ${errorRes.error()?.message}`);
  }
}

demo().catch(console.error);
