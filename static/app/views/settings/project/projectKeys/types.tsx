export type ProjectKey = {
  dateCreated: string;
  id: string;
  browserSdk: {
    choices: [string, string][];
  };
  name: string;
  projectId: number;
  rateLimit: number | null;
  label: string;
  dsn: {
    cdn: string;
    minidump: string;
    csp: string;
    secret: string;
    unreal: string;
    security: string;
    public: string;
  };
  browserSdkVersion: ProjectKey['browserSdk']['choices'][number][0];
  secret: string;
  isActive: boolean;
  public: string;
};
