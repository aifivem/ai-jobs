import { AdminPanel } from "@aicore-fivem/lib/server";
import { jobsSchema } from "./schema";

/** ai-jobs' panel (routes, stops, the hot dog stand). */
export const panel = new AdminPanel(jobsSchema);
