import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDirectory } from "../src/directory-picker.mjs";

test("Windows uses a native STA folder dialog with literal paths and falls back to Windows PowerShell", async () => {
    const calls = [];
    const initial = "C:\\project with spaces\\$literal";
    const selected = "C:\\selected folder\\unicode-\u00e9";
    const result = await pickDirectory(initial, {
        platform: "win32",
        run: async (command, args, options) => {
            calls.push(command);
            assert.ok(args.includes("-STA"));
            assert.ok(args.at(-1).includes("FolderBrowserDialog"));
            assert.ok(!args.at(-1).includes(initial));
            assert.equal(options.env.DYNAMIC_WORKFLOW_STUDIO_DIRECTORY, initial);
            assert.equal(options.shell, undefined);
            if (command === "pwsh.exe") throw Object.assign(new Error("not installed"), { code: "ENOENT" });
            return { stdout: `${selected}\r\n` };
        },
    });
    assert.deepEqual(calls, ["pwsh.exe", "powershell.exe"]);
    assert.equal(result, selected);
});

test("macOS uses its native choose-folder dialog with an argument, not interpolated script", async () => {
    const initial = '/Users/example/folder "with quotes"';
    const selected = "/Users/example/another/";
    assert.equal(await pickDirectory(initial, {
        platform: "darwin",
        run: async (command, args) => {
            assert.equal(command, "/usr/bin/osascript");
            assert.ok(args[1].includes("choose folder"));
            assert.ok(!args[1].includes(initial));
            assert.equal(args.at(-1), initial);
            return { stdout: `${selected}\n` };
        },
    }), selected);
});

test("Linux falls back between desktop pickers without invoking a shell", async () => {
    const calls = [];
    assert.equal(await pickDirectory("/home/example/project", {
        platform: "linux",
        run: async (command, args, options) => {
            calls.push(command);
            assert.ok(["zenity", "kdialog"].includes(command));
            assert.equal(options.shell, undefined);
            if (calls.length === 1) throw Object.assign(new Error("missing"), { code: "ENOENT" });
            return { stdout: "/home/example/new directory\n" };
        },
    }), "/home/example/new directory");
    assert.equal(new Set(calls).size, 2);
});

test("cancel returns no selection and missing/headless picker errors remain explicit", async () => {
    for (const platform of ["win32", "darwin"]) {
        assert.equal(await pickDirectory("/project", { platform, run: async () => ({ stdout: "" }) }), null);
    }
    assert.equal(await pickDirectory("/project", {
        platform: "linux", run: async () => { throw Object.assign(new Error("cancel"), { code: 1, stderr: "" }); },
    }), null);
    await assert.rejects(pickDirectory("/project", {
        platform: "linux", run: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
    }), /Install zenity.*kdialog/);
    await assert.rejects(pickDirectory("/project", {
        platform: "linux", run: async () => { throw Object.assign(new Error("headless"), { code: 1, stderr: "cannot open display" }); },
    }), /cannot open display/);
});
