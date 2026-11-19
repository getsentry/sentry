export type ServiceAccount = {
  allProjects: boolean;
  dateCreated: string;
  id: string;
  name: string;
  projectIds: string[];
  scopes: string[];
};

export type ServiceAccountToken = {
  dateCreated: string;
  dateExpires: string | null;
  dateLastUsed: string | null;
  id: string;
  name: string;
  scopes: string[];
  tokenLastCharacters: string;
};

export type NewServiceAccountToken = ServiceAccountToken & {token: string};
