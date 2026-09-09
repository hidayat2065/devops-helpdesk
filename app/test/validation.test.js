const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTicketInput
} = require("../validation");


test("title kosong harus ditolak", () => {
  const result = validateTicketInput({
    title: ""
  });

  assert.equal(result.valid, false);
  assert.equal(
    result.error,
    "Title wajib diisi"
  );
});


test("priority default adalah Medium", () => {
  const result = validateTicketInput({
    title: "Printer Rusak"
  });

  assert.equal(result.valid, true);
  assert.equal(
    result.value.priority,
    "Medium"
  );
});


test("priority Critical diterima", () => {
  const result = validateTicketInput({
    title: "Server Down",
    priority: "Critical"
  });

  assert.equal(result.valid, true);
  assert.equal(
    result.value.priority,
    "Critical"
  );
});


test("priority tidak valid harus ditolak", () => {
  const result = validateTicketInput({
    title: "Internet Putus",
    priority: "SuperUrgent"
  });

  assert.equal(result.valid, false);
  assert.equal(
    result.error,
    "Priority tidak valid"
  );
});