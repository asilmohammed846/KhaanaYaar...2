
async function listModels() {
  const apiKey = "AIzaSyA7ehhU9i8NvWi7BXtQo66-7VARJFmFNtw";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (data.error) {
       console.error("API ERROR:", data.error.message);
       return;
    }
    const geminiModels = data.models.filter(m => m.name.includes('gemini'));
    console.log(geminiModels.map(m => m.name));
  } catch (err) {
    console.error(err);
  }
}
listModels();
