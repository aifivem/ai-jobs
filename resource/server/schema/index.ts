import type { PanelSchema } from "@aicore-fivem/shared";
import { hotdogFile, hotdogTab } from "./hotdog";
import { routesFile, routesTab } from "./routes";
import { stopsFile, stopsTab } from "./stops";

/** ai-jobs' panel: work routes and their stops (each stop its own record so its place is set in the world). */
export const jobsSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "briefcase",
  files: {
    hotdog: hotdogFile,
    routes: routesFile,
    stops: stopsFile,
  },
  tabs: [routesTab, stopsTab, hotdogTab],
};
