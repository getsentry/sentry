export type App = {
  name: string;
  bundleId: string;
  appId: string;
};

export type StepOneData = {
  issuer?: string;
  keyId?: string;
  privateKey?: string;
};

export type StepTwoData = {
  username?: string;
  password?: string;
};

export type StepThreeData = {
  authenticationCode?: string;
  smsCode?: string;
};

export type AppleStoreOrg = {
  name: string;
  organizationId: number;
};

export type StepFourData = {
  org?: AppleStoreOrg;
  app?: App;
};
