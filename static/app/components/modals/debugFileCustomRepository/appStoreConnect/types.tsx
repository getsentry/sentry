export interface AppStoreApp {
  name: string;
  appId: string;
  bundleId: string;
}

export interface StepOneData {
  issuer?: string;
  keyId?: string;
  privateKey?: string;
  errors?: Record<keyof StepOneData, string | undefined>;
}

export interface StepTwoData {
  app?: AppStoreApp;
}
