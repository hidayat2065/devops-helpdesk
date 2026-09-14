const VALID_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const VALID_STATUSES = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed"
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

function validateTicketStatus(data = {}) {
  const status =
    typeof data.status === "string"
      ? data.status.trim()
      : "";

  if (!VALID_STATUSES.includes(status)) {
    return {
      valid: false,
      error: "Status tidak valid"
    };
  }

  return {
    valid: true,
    value: {
      status
    }
  };
}

module.exports = {
  validateTicketInput,
  validateTicketStatus
};