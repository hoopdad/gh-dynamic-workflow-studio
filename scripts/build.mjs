import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyDistribution } from "./install.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(output, ".build-"));
try {
    await copyDistribution(staging);
    await rm(path.join(output, "dynamic-workflow-studio"), { recursive: true, force: true });
    await rename(staging, path.join(output, "dynamic-workflow-studio"));
} finally {
    await rm(staging, { recursive: true, force: true });
}
console.log("Built dist/dynamic-workflow-studio (run npm ci --omit=dev there to restore dependencies).");
