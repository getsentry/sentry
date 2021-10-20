type ProviderAlert = {
  type?: string;
  text?: string;
};

type Provider = {
  key?: string;
  slug?: string;
  name?: string;
  canAdd?: boolean;
  canDisable?: boolean;
  features?: string[];
  aspects?: {
    alerts?: ProviderAlert[];
  };
};

type ConfigOrganization = any; // this is very complicated and unimportant

export type OrganizationIntegration = {
  id?: string;
  name?: string;
  icon?: string;
  domainName?: string;
  accountType?: string;
  status?: string;
  provider?: Provider;
  configOrganization?: ConfigOrganization[];
  configData: {
    installationType?: string;
  };
  organizationId?: number;
  externalId?: string;
};

type IdentityProvider = {
  id?: string;
  type?: string;
  externalId?: string;
};

export type Identity = {
  id?: string;
  identityProvider?: IdentityProvider;
  externalId?: string;
  status?: string;
};
