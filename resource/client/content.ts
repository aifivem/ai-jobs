import { AdminWorld } from "@aicore-fivem/lib/client";
import { readHotdog } from "common/hotdog";

/** ai-jobs' panel files on the client. */
export const world = new AdminWorld(["routes", "stops", "hotdog"]);
export const hotdog = world.view("hotdog", readHotdog);
