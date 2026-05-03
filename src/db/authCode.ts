import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authCodesTable = pgTable("auth_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
