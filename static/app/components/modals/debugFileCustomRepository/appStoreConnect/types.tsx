export type AppStoreApp = {
  appId: string;
  bundleId: string;
  name: string;
};

export type StepOneData = {
  errors?: Record<keyof StepOneData, string | undefined>;
  issuer?: string;
  keyId?: string;
  privateKey?: string;
};

export type StepTwoData = {
  app?: AppStoreApp;
};
