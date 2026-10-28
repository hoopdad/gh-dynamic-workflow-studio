#!/usr/bin/env node
import path from "node:path";
import { installStudio } from "../scripts/install.mjs";

const args = process.argv.slice(2);
const help = `Dynamic Workflow Studio

Usage:
  dynamic-workflow-studio [project-root]
  dynamic-workflow-studio install --global [--replace]
  dynamic-workflow-studio install <project-root> [--replace]

No project root: observe the current directory. Prints a local browser URL.
Install registers the Copilot canvas and restores production dependencies.
--replace replaces only recognized Studio installations, including the old name.
`;

try {
    if (args.includes("--help") || args.includes("-h")) {
        console.log(help);
    } else if (args[0] === "install") {
        const options = args.slice(1);
        const unknown = options.find((arg) => arg.startsWith("-") && !["--global", "--replace"].includes(arg));
        const roots = options.filter((arg) => !arg.startsWith("-"));
        if (unknown || roots.length > 1 || (options.includes("--global") && roots.length)) throw new Error(help);
        const target = await installStudio(roots[0], {
            global: options.includes("--global"), replace: options.includes("--replace"),
        });
        console.log(`Installed Dynamic Workflow Studio in ${target}\nReload Copilot extensions or restart Copilot.`);
    } else {
        if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) throw new Error(help);
        const { startStudio } = await import("../src/server.mjs");
        const studio = await startStudio(path.resolve(args[0] ?? process.cwd()));
        console.log(`Dynamic Workflow Studio\nProject: ${studio.projectRoot}\nOpen: ${studio.url}\nPress Ctrl+C to stop.`);
        let closing = false;
        const close = async () => {
            if (closing) return;
            closing = true;
            await studio.close();
        };
        process.once("SIGINT", close);
        process.once("SIGTERM", close);
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
