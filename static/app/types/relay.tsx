export interface Relay {
  publicKey: string;
  name: string;
  created?: string;
  lastModified?: string;
  description?: string;
}

export interface RelayActivity {
  publicKey: string;
  relayId: string;
  version: string;
  firstSeen: string;
  lastSeen: string;
}

export interface RelaysByPublickey {
  [publicKey: string]: {
    name: string;
    activities: Array<RelayActivity>;
    description?: string;
    created?: string;
  };
}
