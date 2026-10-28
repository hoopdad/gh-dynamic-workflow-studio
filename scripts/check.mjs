import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await check(file);
        else if (file.endsWith(".mjs")) {
            const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
            if (result.status !== 0) throw new Error(`Syntax check failed: ${file}`);
        }
    }
}
for (const directory of ["src", "bin", "scripts", "test"]) await check(path.join(root, directory));
for (const file of ["extension.mjs", "playwright.config.mjs"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`Syntax check failed: ${file}`);
}
