// https://github.com/pbakondy/ios-device-list#readme

type Options = {
  caseInsensitive?: boolean;
  contains?: boolean;
};

type Device = {
  Type: string;
  Generation: string;
  ANumber: string | string[];
  Bootrom?: string | string[];
  Variant?: string;
  FCCID: string | string[];
  InternalName: string;
  Identifier: string;
  Color: string;
  Storage: string;
  Model: string | string[];
};

export type IOSDeviceList = {
  deviceTypes: () => string[];
  devices: (type?: string) => Device[];
  generations: (type?: string) => [];
  anumbers: (type?: string) => [];
  fccids: (type?: string) => [];
  internalNames: (type?: string) => [];
  identifiers: (type?: string) => [];
  colors: (type?: string) => [];
  storages: (type?: string) => [];
  models: (type?: string) => [];
  deviceByGeneration: (generation: string, type?: string, options?: Options) => Device[];
  deviceByFCCID: (fccid: string[], type?: string, options?: Options) => Device[];
  deviceByInternalName: (name: string, type?: string, options?: Options) => Device[];
  deviceByIdentifier: (id: string, type?: string, options?: Options) => Device[];
  deviceByColor: (color: string, type?: string, options?: Options) => Device[];
  deviceByStorage: (storage: string, type?: string, options?: Options) => Device[];
  deviceByModel: (model: string, type?: string, options?: Options) => Device[];
  generationByIdentifier: (id: string, type?: string) => string;
};
