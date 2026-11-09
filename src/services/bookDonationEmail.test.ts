import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { buildBookDonationMessage, sendBookDonationConfirmation } from "./bookDonationEmail.js";

test("courier donation confirmation requests tracking and receipt details", () => {
  const message = buildBookDonationMessage({
    donor: { fullName: "A & B", email: "donor@example.org" },
    deliveryMethod: "courier",
  });
  assert.match(message.subject, /Courier Instructions/);
  assert.match(message.text, /courier service provider/);
  assert.match(message.text, /AWB\/tracking number/);
  assert.match(message.text, /dispatch date/);
  assert.match(message.text, /courier receipt/);
  assert.match(message.html, /A &amp; B/);
  assert.match(message.html, /mailto:info@indianheritager\.com/);
});

test("office delivery confirmation requests schedule and book count", () => {
  const message = buildBookDonationMessage({
    donor: { fullName: "Donor", email: "donor@example.org" },
    deliveryMethod: "drop_off",
  });
  assert.match(message.subject, /Delivery Scheduling Confirmation/);
  assert.match(message.text, /proposed delivery date/);
  assert.match(message.text, /expected time of arrival/);
  assert.match(message.text, /approximate number of books/);
  assert.match(message.html, /250, East Periyar Nagar/);
});

test("disabled automated email does not attempt delivery", { skip: env.email.enabled }, async () => {
  const result = await sendBookDonationConfirmation({
    _id: new Types.ObjectId(),
    donor: {
      fullName: "Donor",
      email: "donor@example.org",
      phone: "1234567890",
      dateOfBirth: "1990-01-01",
      address: "1 Main Street",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pinCode: "641045",
    },
    deliveryMethod: "courier",
  });

  assert.equal(result.status, "disabled");
});
