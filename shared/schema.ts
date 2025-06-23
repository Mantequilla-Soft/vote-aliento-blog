import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const hive_prices = pgTable("hive_prices", {
  id: serial("id").primaryKey(),
  price: decimal("price", { precision: 10, scale: 6 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertHivePriceSchema = createInsertSchema(hive_prices).pick({
  price: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type HivePrice = typeof hive_prices.$inferSelect;
export type InsertHivePrice = z.infer<typeof insertHivePriceSchema>;

export const voteCalculationSchema = z.object({
  hivePower: z.number().min(0),
});

export type VoteCalculation = z.infer<typeof voteCalculationSchema>;
