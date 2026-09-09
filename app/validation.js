const VALID_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

function validateTicketInput(data = {}) {
  const title =
    typeof data.title === "string"
      ? data.title.trim()
      : "";

  if (!title) {
    return {
      valid: false,
      error: "Title wajib diisi"
    };
  }

  const priority =
    data.priority || "Medium";

  if (!VALID_PRIORITIES.includes(priority)) {
    return {
      valid: false,
      error: "Priority tidak valid"
    };
  }

  return {
    valid: true,
    value: {
      title,
      priority
    }
  };
}

module.exports = {
  validateTicketInput
};