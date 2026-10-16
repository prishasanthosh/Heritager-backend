import type { Request, Response } from "express";
import { BookDonation } from "../models/BookDonation.js";
import { BookRequest } from "../models/BookRequest.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { Donation } from "../models/Donation.js";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { VolunteerApplication } from "../models/VolunteerApplication.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getAdminDashboardOverview = asyncHandler(async (_req: Request, res: Response) => {
  const [
    donations,
    donationsTotal,
    donationsRaised,
    pendingDonations,
    orders,
    ordersTotal,
    pendingOrders,
    productsTotal,
    usersTotal,
    volunteers,
    volunteersTotal,
    newVolunteers,
    bookDonations,
    bookDonationsTotal,
    pendingBookDonations,
    bookRequests,
    bookRequestsTotal,
    pendingBookRequests,
    messages,
    messagesTotal,
    newMessages,
    subscribers,
    subscribersTotal,
  ] = await Promise.all([
    Donation.find()
      .select("_id donorName projectName createdAt paymentStatus amount")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Donation.countDocuments(),
    Donation.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Donation.countDocuments({ paymentStatus: "pending" }),
    Order.find()
      .select("_id user createdAt status total")
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Product.countDocuments(),
    User.countDocuments(),
    VolunteerApplication.find()
      .select("_id name createdAt status")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    VolunteerApplication.countDocuments(),
    VolunteerApplication.countDocuments({ status: "new" }),
    BookDonation.find()
      .select("_id donor.fullName book.title createdAt status")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    BookDonation.countDocuments(),
    BookDonation.countDocuments({ status: "pending_review" }),
    BookRequest.find()
      .select("_id student.fullName book.name createdAt status")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    BookRequest.countDocuments(),
    BookRequest.countDocuments({ status: "pending" }),
    ContactMessage.find()
      .select("_id name subject createdAt status")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    ContactMessage.countDocuments(),
    ContactMessage.countDocuments({ status: "new" }),
    NewsletterSubscriber.find()
      .select("_id email createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    NewsletterSubscriber.countDocuments(),
  ]);

  res.json({
    donations,
    donationsTotal,
    donationsRaised: donationsRaised[0]?.total ?? 0,
    pendingDonations,
    orders,
    ordersTotal,
    pendingOrders,
    productsTotal,
    usersTotal,
    volunteers,
    volunteersTotal,
    newVolunteers,
    bookDonations,
    bookDonationsTotal,
    pendingBookDonations,
    bookRequests,
    bookRequestsTotal,
    pendingBookRequests,
    messages,
    messagesTotal,
    newMessages,
    subscribers,
    subscribersTotal,
  });
});
