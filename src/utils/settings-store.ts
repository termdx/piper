const SETTINGS_FILE = `${process.env.HOME}/.piper/settings.json`;

interface Settings {
  theme?: string;
}

class SettingsStore {
  async load(): Promise<Settings> {
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

  async save(settings: Settings) {
    await Bun.write(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }

  async setTheme(themeName: string) {
    const settings = await this.load();
    settings.theme = themeName;
    await this.save(settings);
  }

  async getTheme(): Promise<string | undefined> {
    const settings = await this.load();
    return settings.theme;
  }
}

export const settingsStore = new SettingsStore();
