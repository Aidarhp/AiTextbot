import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  global.fetch = jest.fn();
});

test("generates text from the submitted prompt", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ text: "An agent performs tasks." }),
  });
  render(<App />);

  fireEvent.change(screen.getByLabelText(/enter text/i), {
    target: { value: "What is an agent?" },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));

  expect(await screen.findByText("An agent performs tasks.")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:3001/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "What is an agent?" }),
  });
  await waitFor(() => {
    expect(screen.getByLabelText(/enter text/i)).toHaveValue("");
  });
});

test("shows an error when text generation fails", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Server is missing GOOGLE_API_KEY." }),
  });
  render(<App />);

  fireEvent.change(screen.getByLabelText(/enter text/i), {
    target: { value: "Write a greeting" },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Server is missing GOOGLE_API_KEY.",
  );
});
