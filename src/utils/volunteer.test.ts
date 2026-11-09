import assert from "node:assert/strict";
import test from "node:test";
import { parseVolunteerFields } from "./volunteer.js";

const validApplication = {
  fullName: "Test Volunteer",
  email: "volunteer@example.org",
  mobileNumber: "+91 9876543210",
  dateOfBirth: "1990-01-01",
  address: "10 Main Road",
  city: "Coimbatore",
  state: "Tamil Nadu",
  country: "India",
  pinCode: "641001",
  currentProfession: "Teacher",
  organizationName: "School",
  educationalQualification: "Graduate",
  occupation: "Working Professional",
  whyVolunteer: "I want to help learners.",
  areasOfInterest: "Education, Fundraising",
  preferredVolunteeringMode: "Remote",
  availability: "Weekends",
  hoursPerWeek: "4",
  skills: "Teaching",
};

test("normalizes the standalone, donation, and shop form field aliases", () => {
  const parsed = parseVolunteerFields(validApplication);
  assert.equal(parsed.name, "Test Volunteer");
  assert.equal(parsed.email, "volunteer@example.org");
  assert.equal(parsed.phone, "+91 9876543210");
  assert.equal(parsed.preferredMode, "Remote");
  assert.equal(parsed.hoursPerWeek, 4);
  assert.deepEqual(parsed.areasOfInterest, ["Education", "Fundraising"]);
});

test("rejects malformed or incomplete volunteer applications", () => {
  assert.throws(() =>
    parseVolunteerFields({
      ...validApplication,
      email: "not-an-email",
      areasOfInterest: [],
    }),
  );
});
