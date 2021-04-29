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
  itunesAuthenticationCode?: string;
  smsCode?: string;
};

export type StepFourData = {
  app?: App;
};
