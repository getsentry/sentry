export type ProjectKey = {
  browserSdk: {
    choices: [string, string][];
  };
  browserSdkVersion: ProjectKey['browserSdk']['choices'][number][0];
  dateCreated: string;
  dsn: {
    cdn: string;
    csp: string;
    minidump: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string;
};
