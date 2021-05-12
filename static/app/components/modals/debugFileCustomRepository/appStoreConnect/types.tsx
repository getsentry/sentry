export type App = {
  name: string;
  appId: string;
};

export type AppleStoreOrg = {
  name: string;
  organizationId: number;
};

export type AppStoreCredentialsStepOneData = {
  issuer?: string;
  keyId?: string;
  privateKey?: string;
};

export type AppStoreCredentialsStepTwoData = {
  app?: App;
};

export type AppStoreCredentialsData = AppStoreCredentialsStepOneData &
  AppStoreCredentialsStepTwoData;

export type ItunesCredentialsStepOneData = {
  username?: string;
  password?: string;
};

export type ItunesCredentialsStepTwoData = {
  authenticationCode?: string;
};

export type ItunesCredentialsStepThreeData = {
  org?: AppleStoreOrg;
};

export type ItunesCredentialsData = ItunesCredentialsStepOneData &
  ItunesCredentialsStepThreeData &
  ItunesCredentialsStepTwoData & {sessionContext?: string; useSms?: boolean};
