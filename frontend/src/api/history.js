
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const GUEST_KEY = "splitmate_guest_token";

// ==========================================
// GUEST TOKEN
// ==========================================

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

// ==========================================
// COMMON API REQUEST FUNCTION
// ==========================================

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(
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

} catch {
  if (!navigator.onLine) {
    throw new Error(
      "You're offline. Connect to the internet to access your saved bills."
    );
  }

  throw new Error(
    "Unable to connect to the server. Please check your connection and try again."
  );
}

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

// ==========================================
// BILL HISTORY API
// ==========================================

export const historyApi = {

  // ----------------------------------------
  // GET ALL SAVED BILLS
  // ----------------------------------------

  list() {
    return request("/bills/");
  },

  // ----------------------------------------
  // CREATE A NEW BILL
  // ----------------------------------------

  create(bill) {
    return request("/bills/", {
      method: "POST",
      body: JSON.stringify(bill),
    });
  },

  // ----------------------------------------
  // GET ONE SAVED BILL
  // ----------------------------------------

  get(id) {
    return request(
      `/bills/${encodeURIComponent(id)}/`
    );
  },

  // ----------------------------------------
  // RENAME A SAVED BILL
  // ----------------------------------------

  rename(id, title) {
    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "PATCH",

        body: JSON.stringify({
          title,
        }),
      }
    );
  },

  // ----------------------------------------
  // UPDATE PAYMENT STATUS
  // ----------------------------------------

  updatePayment(id, transferIndex, status) {
    const allowedStatuses = [
      "pending",
      "awaiting",
      "confirmed",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error(
        "Invalid payment status."
      );
    }

    if (
      !Number.isInteger(transferIndex) ||
      transferIndex < 0
    ) {
      throw new Error(
        "Invalid transfer index."
      );
    }

    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "PATCH",

        body: JSON.stringify({
          transferIndex,
          status,
        }),
      }
    );
  },

  // ----------------------------------------
  // UPDATE RECIPIENT UPI IDS (NEW)
  // ----------------------------------------

  updateUpiIds(id, upiIds) {
    if (
      !upiIds ||
      typeof upiIds !== "object" ||
      Array.isArray(upiIds)
    ) {
      throw new Error(
        "Invalid UPI details."
      );
    }

    const upiPattern =
      /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;

    const cleaned = {};

    for (const [friendId, value] of Object.entries(
      upiIds
    )) {
      if (typeof value !== "string") {
        throw new Error(
          "Invalid UPI ID."
        );
      }

      const upiId = value.trim();

      if (!upiId) {
        continue;
      }

      if (
        upiId.length > 120 ||
        !upiPattern.test(upiId)
      ) {
        throw new Error(
          `Invalid UPI ID for ${friendId}.`
        );
      }

      cleaned[friendId] = upiId;
    }

    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "PATCH",

        body: JSON.stringify({
          upiIds: cleaned,
        }),
      }
    );
  },

  // ----------------------------------------
  // DELETE A SAVED BILL
  // ----------------------------------------

  delete(id) {
    return request(
      `/bills/${encodeURIComponent(id)}/`,
      {
        method: "DELETE",
      }
    );
  },
};
