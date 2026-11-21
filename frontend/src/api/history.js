
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const GUEST_KEY = "splitmate_guest_token";

export function getGuestToken() {
  let token = localStorage.getItem(GUEST_KEY);

  if (token && /^[a-f0-9]{64}$/.test(token)) {
    return token;
  }

  if (!window.crypto?.getRandomValues) {
    throw new Error(
      "Secure browser random generation is unavailable."
    );
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);

  token = Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");

  localStorage.setItem(GUEST_KEY, token);

  return token;
}

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE}/api/history${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Guest-Token": getGuestToken(),
        ...options.headers,
      },
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned HTTP ${response.status}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Something went wrong."
    );
  }

  return data;
}

export const historyApi = {
  list() {
    return request("/bills/");
  },

  create(bill) {
    return request("/bills/", {
      method: "POST",
      body: JSON.stringify(bill),
    });
  },

  get(id) {
    return request(
      `/bills/${encodeURIComponent(id)}/`
    );
  },

  updatePayment(id, transferIndex, paid) {
    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          transferIndex,
          paid,
        }),
      }
    );
  },

  delete(id) {
    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "DELETE",
      }
    );
  },
};
