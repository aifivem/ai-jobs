import { aiLogChannels } from "@aifivem/lib/server";

// The hot dog stand logs its sales on `hotdog` (server/hotdog/).
aiLogChannels({ work: { active: false }, hotdog: { active: false } });
