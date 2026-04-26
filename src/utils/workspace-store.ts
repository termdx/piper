import { mkdir } from "node:fs/promises";

const WORKSPACES_FILE = `${process.env.HOME}/.piper/workspaces.json`;
const SETTINGS_FILE = `${process.env.HOME}/.piper/settings.json`;
const WORKSPACES_DIR = `${process.env.HOME}/.piper/workspaces`;

interface WorkspacesRegistry {
  workspaces: string[];
}

interface Settings {
  theme?: string;
  currentWorkspace?: string;
}

class WorkspaceStore {
  async loadRegistry(): Promise<WorkspacesRegistry> {
    try {
      const file = Bun.file(WORKSPACES_FILE);
      if (!(await file.exists())) return { workspaces: [] };
      const data = await file.json();
      if (data && typeof data === "object" && Array.isArray(data.workspaces)) {
        return data as WorkspacesRegistry;
      }
      return { workspaces: [] };
    } catch {
      return { workspaces: [] };
    }
  }

  async saveRegistry(registry: WorkspacesRegistry) {
    await Bun.write(WORKSPACES_FILE, JSON.stringify(registry, null, 2));
  }

  async listWorkspaces(): Promise<string[]> {
    const registry = await this.loadRegistry();
    return registry.workspaces;
  }

  async workspaceExists(name: string): Promise<boolean> {
    const registry = await this.loadRegistry();
    return registry.workspaces.includes(name);
  }

  async createWorkspace(name: string): Promise<boolean> {
    if (!name.trim()) return false;
    const registry = await this.loadRegistry();
    if (registry.workspaces.includes(name)) return false;
    registry.workspaces.push(name);
    await this.saveRegistry(registry);
    await mkdir(`${WORKSPACES_DIR}/${name}`, { recursive: true });
    return true;
  }

  async deleteWorkspace(name: string): Promise<boolean> {
    const registry = await this.loadRegistry();
    const idx = registry.workspaces.indexOf(name);
    if (idx === -1) return false;
    registry.workspaces.splice(idx, 1);
    await this.saveRegistry(registry);
    try {
      await Bun.file(`${WORKSPACES_DIR}/${name}/history.json`).delete();
    } catch { /* ignore */ }
    try {
      await Bun.file(`${WORKSPACES_DIR}/${name}`).delete();
    } catch { /* ignore */ }
    return true;
  }

  async renameWorkspace(oldName: string, newName: string): Promise<boolean> {
    if (!newName.trim() || oldName === newName) return false;
    const registry = await this.loadRegistry();
    if (!registry.workspaces.includes(oldName)) return false;
    if (registry.workspaces.includes(newName)) return false;
    const idx = registry.workspaces.indexOf(oldName);
    registry.workspaces[idx] = newName;
    await this.saveRegistry(registry);
    // Rename directory by copying history file (Bun doesn't have fs.rename for dirs easily)
    await mkdir(`${WORKSPACES_DIR}/${newName}`, { recursive: true });
    try {
      const history = await Bun.file(`${WORKSPACES_DIR}/${oldName}/history.json`).text();
      await Bun.write(`${WORKSPACES_DIR}/${newName}/history.json`, history);
      await Bun.file(`${WORKSPACES_DIR}/${oldName}/history.json`).delete();
    } catch { /* ignore */ }
    // Update current workspace if it was the old name
    const settings = await this.loadSettings();
    if (settings.currentWorkspace === oldName) {
      settings.currentWorkspace = newName;
      await this.saveSettings(settings);
    }
    return true;
  }

  getHistoryPath(workspaceName: string): string {
    return `${WORKSPACES_DIR}/${workspaceName}/history.json`;
  }

  async loadSettings(): Promise<Settings> {
    try {
      const file = Bun.file(SETTINGS_FILE);
      if (!(await file.exists())) return {};
      const data = await file.json();
      if (data && typeof data === "object") return data as Settings;
      return {};
    } catch {
      return {};
    }
  }

  async saveSettings(settings: Settings) {
    await Bun.write(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }

  async setCurrentWorkspace(name: string) {
    const settings = await this.loadSettings();
    settings.currentWorkspace = name;
    await this.saveSettings(settings);
  }
}

export const workspaceStore = new WorkspaceStore();
