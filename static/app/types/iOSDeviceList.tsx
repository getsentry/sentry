// https://github.com/pbakondy/ios-device-list#readme

type Options = {
  caseInsensitive?: boolean;
  contains?: boolean;
};

interface Device {
  ANumber: string | string[];
  Color: string;
  FCCID: string | string[];
  Generation: string;
  Identifier: string;
  InternalName: string;
  Model: string | string[];
  Storage: string;
  Type: string;
  Bootrom?: string | string[];
  Variant?: string;
}

export interface IOSDeviceList {
  anumbers: (type?: string) => [];
  colors: (type?: string) => [];
  deviceByColor: (color: string, type?: string, options?: Options) => Device[];
  deviceByFCCID: (fccid: string[], type?: string, options?: Options) => Device[];
  deviceByGeneration: (generation: string, type?: string, options?: Options) => Device[];
  deviceByIdentifier: (id: string, type?: string, options?: Options) => Device[];
  deviceByInternalName: (name: string, type?: string, options?: Options) => Device[];
  deviceByModel: (model: string, type?: string, options?: Options) => Device[];
  deviceByStorage: (storage: string, type?: string, options?: Options) => Device[];
  deviceTypes: () => string[];
  devices: (type?: string) => Device[];
  fccids: (type?: string) => [];
  generationByIdentifier: (id: string, type?: string) => string | undefined;
  generations: (type?: string) => [];
  identifiers: (type?: string) => [];
  internalNames: (type?: string) => [];
  models: (type?: string) => [];
  storages: (type?: string) => [];
}
