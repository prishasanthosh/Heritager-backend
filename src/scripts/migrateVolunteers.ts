import mongoose from "mongoose";
import { env } from "../config/env.js";

type IndexInfo = {
  name?: string;
  key: Record<string, number>;
  unique?: boolean;
  partialFilterExpression?: Record<string, { $type?: string }>;
};

async function migrate(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  if (apply && !args.includes("--backup-confirmed")) {
    throw new Error("Before applying, make and verify a database backup, then pass --backup-confirmed.");
  }

  await mongoose.connect(env.mongoUri);
  const database = mongoose.connection.db;
  if (!database) throw new Error("Connected without a selected database");

  const volunteers = database.collection("volunteerapplications");
  const donations = database.collection("bookdonations");
  const [hasVolunteers, hasDonations] = await Promise.all([
    database.listCollections({ name: "volunteerapplications" }, { nameOnly: true }).hasNext(),
    database.listCollections({ name: "bookdonations" }, { nameOnly: true }).hasNext(),
  ]);
  const [volunteerIndexes, donationIndexes] = await Promise.all([
    hasVolunteers ? volunteers.listIndexes().toArray() as Promise<IndexInfo[]> : [],
    hasDonations ? donations.listIndexes().toArray() as Promise<IndexInfo[]> : [],
  ]);

  const duplicateSummary = hasVolunteers
    ? await volunteers
        .aggregate<{ groups: number; records: number }>([
          { $match: { email: { $type: "string", $ne: "" } } },
          {
            $group: {
              _id: { $toLower: { $trim: { input: "$email" } } },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
          { $group: { _id: null, groups: { $sum: 1 }, records: { $sum: "$count" } } },
        ])
        .toArray()
    : [];
  const emailsNeedingNormalization = hasVolunteers
    ? await volunteers
        .aggregate<{ count: number }>([
          { $match: { email: { $type: "string" } } },
          {
            $project: {
              email: 1,
              normalized: { $toLower: { $trim: { input: "$email" } } },
            },
          },
          { $match: { $expr: { $ne: ["$email", "$normalized"] } } },
          { $count: "count" },
        ])
        .toArray()
    : [];
  const [volunteerCount, sourceMissing, areasMissing, donationCount] = await Promise.all([
    hasVolunteers ? volunteers.countDocuments() : 0,
    hasVolunteers ? volunteers.countDocuments({ registrationSource: { $exists: false } }) : 0,
    hasVolunteers ? volunteers.countDocuments({ areasOfInterest: { $exists: false } }) : 0,
    hasDonations ? donations.countDocuments() : 0,
  ]);

  const emailIndex = volunteerIndexes.find(
    (index) => index.key.email === 1,
  );
  const donationKeyIndex = donationIndexes.find(
    (index) => index.key.idempotencyKey === 1,
  );
  const indexConflicts = [
    ...(emailIndex && (emailIndex.unique !== true || emailIndex.name !== "volunteer_email_unique")
      ? [`Volunteer email index conflicts with existing "${emailIndex.name ?? "unnamed"}" index`]
      : []),
    ...(donationKeyIndex &&
    (donationKeyIndex.unique !== true ||
      donationKeyIndex.partialFilterExpression?.idempotencyKey?.$type !== "string")
      ? [`Donation idempotency index conflicts with existing "${donationKeyIndex.name ?? "unnamed"}" index`]
      : []),
  ];
  const targetHost = new URL(env.mongoUri).hostname;
  const target = `${targetHost}/${mongoose.connection.name}`;
  const report = {
    environment: env.nodeEnv,
    target,
    existingRecords: {
      volunteers: volunteerCount,
      donations: donationCount,
    },
    changesExpected: {
      volunteerEmailsNeedingTrimOrLowercase: emailsNeedingNormalization[0]?.count ?? 0,
      volunteerRecordsMissingSourceDefault: sourceMissing,
      volunteerRecordsMissingAreasDefault: areasMissing,
      donationRecordsModified: 0,
    },
    duplicateVolunteerEmails: {
      groups: duplicateSummary[0]?.groups ?? 0,
      recordsInDuplicateGroups: duplicateSummary[0]?.records ?? 0,
    },
    indexConflicts,
    mode: apply ? "apply" : "read-only dry run",
  };
  console.log(JSON.stringify(report, null, 2));

  try {
    if (!apply) {
      console.log("[migration] dry run only; no records or indexes were modified");
      return;
    }

    const confirmedTarget = args.find((argument) => argument.startsWith("--confirm-target="))?.slice(
      "--confirm-target=".length,
    );
    if (confirmedTarget !== target) {
      throw new Error(`Target confirmation mismatch. Pass --confirm-target="${target}" after verifying this target.`);
    }
    if ((duplicateSummary[0]?.groups ?? 0) > 0) {
      throw new Error("Migration stopped before writes: duplicate volunteer email addresses must be resolved.");
    }
    if (indexConflicts.length > 0) {
      throw new Error("Migration stopped before writes: resolve the reported index conflicts first.");
    }

    await volunteers.updateMany(
      { email: { $type: "string" } },
      [{ $set: { email: { $toLower: { $trim: { input: "$email" } } } } }],
    );
    await volunteers.updateMany(
      { registrationSource: { $exists: false } },
      { $set: { registrationSource: "standalone" } },
    );
    await volunteers.updateMany(
      { areasOfInterest: { $exists: false } },
      { $set: { areasOfInterest: [] } },
    );

    await volunteers.createIndex({ email: 1 }, { unique: true, name: "volunteer_email_unique" });
    await volunteers.createIndex({ registrationSource: 1, createdAt: -1 });
    await volunteers.createIndex({ bookDonation: 1 });
    await volunteers.createIndex({ order: 1 });
    await donations.createIndex(
      { idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: "string" } },
      },
    );

    console.log(`[migration] volunteer indexes and defaults applied to "${mongoose.connection.name}"`);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((error: unknown) => {
  console.error("[migration] failed", error);
  process.exitCode = 1;
});
