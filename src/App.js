import { useState } from "react";

const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";

function App() {
  const [input, setInput] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const prompt = input.trim();

    if (!prompt || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setText("");

    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status}).`);
      }
      if (typeof result.text !== "string") {
        throw new Error("The server returned an invalid response.");
      }

      setText(result.text);
      setInput("");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Text generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section>
      <div className="App">
        <form onSubmit={handleSubmit}>
          <label htmlFor="prompt">Enter text</label>
          <input
            id="prompt"
            type="text"
            placeholder="Enter text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" disabled={!input.trim() || isGenerating}>
            {isGenerating ? "Generating..." : "Submit"}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {text && <p aria-live="polite">{text}</p>}
      </div>
    </section>
  );
}

export default App;
