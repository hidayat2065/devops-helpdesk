const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  validateTicketInput,
  validateTicketStatus
} = require("../validation");


test(
  "title kosong harus ditolak",
  () => {

    const result =
      validateTicketInput({
        title: ""
      });

    assert.equal(
      result.valid,
      false
    );

  }
);


test(
  "priority default adalah Medium",
  () => {

    const result =
      validateTicketInput({
        title: "Printer offline"
      });

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.value.priority,
      "Medium"
    );

  }
);


test(
  "priority Critical diterima",
  () => {

    const result =
      validateTicketInput({
        title: "Server down",
        priority: "Critical"
      });

    assert.equal(
      result.valid,
      true
    );

  }
);


test(
  "priority tidak valid harus ditolak",
  () => {

    const result =
      validateTicketInput({
        title: "WiFi lambat",
        priority: "Darurat"
      });

    assert.equal(
      result.valid,
      false
    );

  }
);


test(
  "status Open diterima",
  () => {

    const result =
      validateTicketStatus({
        status: "Open"
      });

    assert.equal(
      result.valid,
      true
    );

  }
);


test(
  "status In Progress diterima",
  () => {

    const result =
      validateTicketStatus({
        status: "In Progress"
      });

    assert.equal(
      result.valid,
      true
    );

  }
);


test(
  "status tidak valid harus ditolak",
  () => {

    const result =
      validateTicketStatus({
        status: "Rusak"
      });

    assert.equal(
      result.valid,
      false
    );

  }
);

test(
  "status Closed diterima",
  () => {

    const result =
      validateTicketStatus({
        status: "Closed"
      });

    assert.equal(
      result.valid,
      true
    );

  }
);