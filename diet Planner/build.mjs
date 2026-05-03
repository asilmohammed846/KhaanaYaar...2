import { build } from 'vite';

build().catch(err => {
  console.error("=== VITE BUILD FAILED ===");
  console.error(err);
  if (err.errors) {
    console.error("ERRORS ARRAY:", JSON.stringify(err.errors, null, 2));
  }
  if (err.message) {
    console.error("MESSAGE:", err.message);
  }
  if (err.id) {
    console.error("FILE ID:", err.id);
  }
  if (err.plugin) {
    console.error("PLUGIN:", err.plugin);
  }
  if (err.code) {
    console.error("CODE:", err.code);
  }
  process.exit(1);
});
