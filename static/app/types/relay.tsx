export type Relay = {
  name: string;
  publicKey: string;
  created?: string;
  description?: string;
  lastModified?: string;
};

export type RelayActivity = {
  firstSeen: string;
  lastSeen: string;
  publicKey: string;
  relayId: string;
  version: string;
};

export type RelaysByPublickey = Record<
  string,
  {
    activities: RelayActivity[];
    name: string;
    created?: string;
    description?: string;
  }
>;
