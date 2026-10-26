import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bindings } from "../bindings.server";

const reportInput = z.object({
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  category: z.enum(["Dust", "Smoke", "Odour", "Haze", "Traffic", "Other"]),
  feeling: z.enum(["Normal", "Dusty", "Smoky", "Irritating", "Unusual" ]),
  note: z.string().trim().min(8).max(420),
});
const commentInput = z.object({
  reportId: z.number().int().positive(),
  displayName: z.string().trim().min(2).max(32),
  body: z.string().trim().min(3).max(280),
});

export const getCommunityReports = createServerFn({ method: "POST" })
  .validator(z.object({ limit: z.number().int().min(1).max(40).default(20) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { reports: [], storageReady: false };
    const reports = await DB.prepare(
      "SELECT id, city, area, latitude, longitude, category, feeling, note, created_at FROM neighborhood_reports WHERE status = 'approved' ORDER BY created_at DESC LIMIT ?",
    ).bind(data.limit).all();
    return { reports: reports.results ?? [], storageReady: true };
  });

export const getReportComments = createServerFn({ method: "POST" })
  .validator(z.object({ reportId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { comments: [], storageReady: false };
    const comments = await DB.prepare(
      "SELECT id, report_id, display_name, body, created_at FROM report_comments WHERE report_id = ? AND status = 'approved' ORDER BY created_at ASC LIMIT 60",
    ).bind(data.reportId).all();
    return { comments: comments.results ?? [], storageReady: true };
  });

export const submitNeighborhoodReport = createServerFn({ method: "POST" })
  .validator(reportInput)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { ok: false, message: "Community storage is not configured yet." };
    const lat = data.latitude == null ? null : Math.round(data.latitude * 100) / 100;
    const lon = data.longitude == null ? null : Math.round(data.longitude * 100) / 100;
    await DB.prepare(
      "INSERT INTO neighborhood_reports (city, area, latitude, longitude, category, feeling, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
    ).bind(data.city, data.area, lat, lon, data.category, data.feeling, data.note).run();
    return { ok: true, message: "Thanks. Your report is in the moderation queue and will appear after review." };
  });

export const submitReportComment = createServerFn({ method: "POST" })
  .validator(commentInput)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { ok: false, message: "Community storage is not configured yet." };
    const parent = await DB.prepare("SELECT id FROM neighborhood_reports WHERE id = ? AND status = 'approved'").bind(data.reportId).first();
    if (!parent) return { ok: false, message: "That report is no longer available." };
    await DB.prepare(
      "INSERT INTO report_comments (report_id, display_name, body, status) VALUES (?, ?, ?, 'pending')",
    ).bind(data.reportId, data.displayName, data.body).run();
    return { ok: true, message: "Comment submitted for review." };
  });

export const getModerationQueue = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().min(1).max(180) }))
  .handler(async ({ data }) => {
    const { DB, AIRPULSE_MODERATOR_KEY } = bindings() as ReturnType<typeof bindings> & { AIRPULSE_MODERATOR_KEY?: string };
    if (!AIRPULSE_MODERATOR_KEY || data.key !== AIRPULSE_MODERATOR_KEY) return { ok: false, reports: [], comments: [] };
    if (!DB) return { ok: true, reports: [], comments: [] };
    const reports = await DB.prepare("SELECT id, city, area, category, feeling, note, created_at FROM neighborhood_reports WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100").all();
    const comments = await DB.prepare("SELECT id, report_id, display_name, body, created_at FROM report_comments WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100").all();
    return { ok: true, reports: reports.results ?? [], comments: comments.results ?? [] };
  });

export const moderateCommunityItem = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().min(1).max(180), kind: z.enum(["report", "comment"]), id: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) }))
  .handler(async ({ data }) => {
    const { DB, AIRPULSE_MODERATOR_KEY } = bindings() as ReturnType<typeof bindings> & { AIRPULSE_MODERATOR_KEY?: string };
    if (!AIRPULSE_MODERATOR_KEY || data.key !== AIRPULSE_MODERATOR_KEY) return { ok: false, message: "Moderator key is not valid." };
    if (!DB) return { ok: false, message: "Community storage is not configured." };
    const table = data.kind === "report" ? "neighborhood_reports" : "report_comments";
    await DB.prepare(`UPDATE ${table} SET status = ? WHERE id = ? AND status = 'pending'`).bind(data.decision, data.id).run();
    return { ok: true, message: `Item ${data.decision}.` };
  });
