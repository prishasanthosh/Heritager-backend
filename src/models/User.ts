import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAddress {
  _id: Types.ObjectId;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: "customer" | "admin";
  phone?: string;
  addresses: Types.DocumentArray<IAddress>;
  refreshTokenVersion: number;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, {}, IUserMethods>;

const addressSchema = new Schema<IAddress>(
  {
    label: { type: String, default: "Home" },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "India" },
    phone: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    phone: { type: String },
    addresses: { type: [addressSchema], default: [] },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.method("comparePassword", function comparePassword(this: UserDoc, candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
});

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.refreshTokenVersion;
    delete obj.__v;
    return obj;
  },
});

export const User = model<IUser, UserModel>("User", userSchema);
