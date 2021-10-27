export type AppStoreApp = {
  name: string;
  appId: string;
  bundleId: string;
};

export type AppleStoreOrg = {
  name: string;
  organizationId: number;
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

export type StepThreeData = {
  username?: string;
  password?: string;
};

export type StepFourData = {
  authenticationCode?: string;
};

export type StepFifthData = {
  org?: AppleStoreOrg;
};
