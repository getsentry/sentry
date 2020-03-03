export type PlatformType = 'java' | 'csharp' | 'other';

export type Frame = {
  filename: string;
  module: string;
  map: string;
  preventCollapse: () => void;
  errors: Array<any>;
  context: Array<[number, string]>;
  vars: {[key: string]: any};
  inApp: boolean;
  function?: string;
  absPath?: string;
  rawFunction?: string;
  platform: PlatformType;
  lineNo?: number;
  colNo?: number;
  package?: string;
  origAbsPath?: string;
  mapUrl?: string;
};
