/**
 * Workbench Patcher — Install/uninstall integration scripts into workbench.html.
 *
 * Handles the file-level modification of Antigravity's workbench.html
 * to include/remove custom script tags.
 *
 * @module integration/workbench-patcher
 *
 * @internal
 */

import * as fs from 'fs';
import * as path from 'path';

/** Default prefix for generated files */
const FILE_PREFIX = 'ag-sdk';

/**
 * Manages patching/unpatching of Antigravity's workbench.html.
 */
export class WorkbenchPatcher {
    private readonly _workbenchDir: string;
    private readonly _workbenchHtml: string;
    private readonly _scriptPath: string;
    private readonly _heartbeatPath: string;

    private readonly _markerStart: string;
    private readonly _markerEnd: string;

    /**
     * @param namespace - Unique slug for this extension (e.g. 'kanezal-better-antigravity').
     *   Used to namespace all generated files and HTML markers so multiple
     *   SDK-based extensions can coexist without conflicts.
     */
    constructor(namespace: string = 'default') {
        // Resolve Antigravity install path
        const appData = process.env.LOCALAPPDATA || '';
        this._workbenchDir = path.join(
            appData,
            'Programs',
            'Antigravity',
            'resources',
            'app',
            'out',
            'vs',
            'code',
            'electron-browser',
            'workbench',
        );
        this._workbenchHtml = path.join(this._workbenchDir, 'workbench.html');

        const slug = namespace.replace(/[^a-zA-Z0-9-]/g, '-');
        this._scriptPath = path.join(this._workbenchDir, `${FILE_PREFIX}-${slug}.js`);
        this._heartbeatPath = path.join(this._workbenchDir, `${FILE_PREFIX}-${slug}-heartbeat`);
        this._markerStart = `<!-- AG SDK [${slug}] -->`;
        this._markerEnd = `<!-- /AG SDK [${slug}] -->`;
    }

    /**
     * Check if workbench.html exists and is accessible.
     */
    isAvailable(): boolean {
        return fs.existsSync(this._workbenchHtml);
    }

    /**
     * Check if our integration is currently installed.
     */
    isInstalled(): boolean {
        if (!this.isAvailable()) return false;
        try {
            const content = fs.readFileSync(this._workbenchHtml, 'utf8');
            return content.includes(this._markerStart);
        } catch {
            return false;
        }
    }

    /**
     * Install the integration script.
     *
     * 1. Writes the script file to the workbench directory
     * 2. Patches workbench.html to include a <script> tag
     *
     * @param scriptContent — The generated JavaScript code
     */
    install(scriptContent: string): void {
        if (!this.isAvailable()) {
            throw new Error(`Workbench not found at: ${this._workbenchDir}`);
        }

        // First uninstall any previous integration for THIS namespace
        if (this.isInstalled()) {
            this.uninstall();
        }

        // Write the script file
        fs.writeFileSync(this._scriptPath, scriptContent, 'utf8');

        // Patch workbench.html
        let html = fs.readFileSync(this._workbenchHtml, 'utf8');

        // Insert before </html>
        const scriptBasename = path.basename(this._scriptPath);
        const scriptTag = [
            this._markerStart,
            `<script src="./${scriptBasename}"></script>`,
            this._markerEnd,
        ].join('\n');

        html = html.replace('</html>', `${scriptTag}\n</html>`);
        fs.writeFileSync(this._workbenchHtml, html, 'utf8');
    }

    /**
     * Remove the integration.
     *
     * 1. Removes the <script> tag from workbench.html
     * 2. Deletes the script file
     */
    uninstall(): void {
        if (!this.isAvailable()) return;

        // Remove from workbench.html
        try {
            let html = fs.readFileSync(this._workbenchHtml, 'utf8');
            const regex = new RegExp(
                `\\n?${escapeRegex(this._markerStart)}[\\s\\S]*?${escapeRegex(this._markerEnd)}\\n?`,
                'g',
            );
            html = html.replace(regex, '');
            fs.writeFileSync(this._workbenchHtml, html, 'utf8');
        } catch {
            // Ignore errors during cleanup
        }

        // Remove script file
        try {
            if (fs.existsSync(this._scriptPath)) {
                fs.unlinkSync(this._scriptPath);
            }
        } catch {
            // Ignore
        }
    }

    /**
     * Write/refresh the heartbeat marker file.
     *
     * The generated script checks this file's modification time
     * to determine if the extension is still active. If the file
     * is missing or stale, the script will not start.
     */
    writeHeartbeat(): void {
        try {
            fs.writeFileSync(this._heartbeatPath, Date.now().toString(), 'utf8');
        } catch {
            // Ignore — workbench dir may not be writable
        }
    }

    /**
     * Remove the heartbeat marker file.
     */
    removeHeartbeat(): void {
        try {
            if (fs.existsSync(this._heartbeatPath)) {
                fs.unlinkSync(this._heartbeatPath);
            }
        } catch {
            // Ignore
        }
    }

    /**
     * Get the path to the heartbeat file.
     */
    getHeartbeatPath(): string {
        return this._heartbeatPath;
    }

    /**
     * Get the path to the workbench directory.
     */
    getWorkbenchDir(): string {
        return this._workbenchDir;
    }

    /**
     * Get the path to the script file.
     */
    getScriptPath(): string {
        return this._scriptPath;
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
