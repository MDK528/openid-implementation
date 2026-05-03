// make a appliocation model with the following fields
// fields = id, name, client_id, client_secret, redirect_uri, created_at

import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const applicationsTable = pgTable("applications", {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationName: varchar("name", { length: 100 }).notNull(),
    clientId: varchar("client_id", { length: 100 }).notNull(),
    clientSecret: varchar("client_secret", { length: 100 }).notNull(),
    redirectUri: text("redirect_uri").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date())
})
