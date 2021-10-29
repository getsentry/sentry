export type AppStoreApp = {
  name: string;
  appId: string;
  bundleId: string;
};
export type StepOneData = {
  issuer?: string;
  keyId?: string;
  privateKey?: string;
  errors?: Record<keyof StepOneData, string | undefined>;
};

export type StepTwoData = {
  app?: AppStoreApp;
};
