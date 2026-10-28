import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const windowsScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
$dialog.Description = 'Choose project directory'
$dialog.SelectedPath = $env:DYNAMIC_WORKFLOW_STUDIO_DIRECTORY
$dialog.ShowNewFolderButton = $false
try {
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::WriteLine($dialog.SelectedPath)
    }
} finally { $dialog.Dispose() }
`;
const macScript = `on run argv
    try
        set selectedFolder to choose folder with prompt "Choose project directory" default location (POSIX file (item 1 of argv))
        return POSIX path of selectedFolder
    on error number -128
        return ""
    end try
end run`;

export async function pickDirectory(initialDirectory, {
    platform = process.platform, run = execute, signal,
} = {}) {
    let candidates;
    if (platform === "win32") {
        candidates = ["pwsh.exe", "powershell.exe"].map((command) => ({
            command, args: ["-NoProfile", "-STA", "-NonInteractive", "-Command", windowsScript],
        }));
    } else if (platform === "darwin") {
        candidates = [{ command: "/usr/bin/osascript", args: ["-e", macScript, initialDirectory] }];
    } else if (platform === "linux") {
        const gtk = { command: "zenity", args: ["--file-selection", "--directory",
            "--title=Choose project directory", `--filename=${initialDirectory.replace(/\/?$/, "/")}`] };
        const kde = { command: "kdialog", args: ["--getexistingdirectory", initialDirectory, "--title", "Choose project directory"] };
        candidates = /KDE/i.test(process.env.XDG_CURRENT_DESKTOP ?? "") ? [kde, gtk] : [gtk, kde];
    } else {
        throw new Error("Native directory selection is supported on Windows, macOS and Linux desktops.");
    }
    for (const { command, args } of candidates) {
        try {
            const { stdout } = await run(command, args, {
                encoding: "utf8", windowsHide: true, timeout: 300_000, maxBuffer: 128 * 1024, signal,
                env: { ...process.env, DYNAMIC_WORKFLOW_STUDIO_DIRECTORY: initialDirectory },
            });
            return stdout.replace(/^\uFEFF/, "").replace(/[\r\n]+$/, "") || null;
        } catch (error) {
            if (error.code === "ENOENT") continue;
            if (platform === "linux" && error.code === 1 && !error.stderr?.trim()) return null;
            if (error.killed) throw new Error("Directory selection timed out. Please try again.");
            throw new Error(`Could not open the system directory picker: ${error.stderr?.trim() || error.message}`, { cause: error });
        }
    }
    throw new Error(platform === "linux"
        ? "No desktop folder picker found. Install zenity (GNOME/GTK) or kdialog (KDE), or relaunch Studio with the desired project path."
        : "Windows PowerShell is required to open the system directory picker.");
}
