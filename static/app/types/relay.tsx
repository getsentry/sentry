export type Relay = {
  publicKey: string;
  name: string;
  created?: string;
  lastModified?: string;
  description?: string;
};

export type RelayActivity = {
  publicKey: string;
  relayId: string;
  version: string;
  firstSeen: string;
  lastSeen: string;
};

export type RelaysByPublickey = {
  [publicKey: string]: {
    name: string;
    activities: Array<RelayActivity>;
    description?: string;
    created?: string;
  };
};
