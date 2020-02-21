export type PlatformType = 'java' | 'csharp' | 'other';

export type Data = {
  filename: string;
  module: string;
  function?: string;
  absPath?: string;
  rawFunction?: string;
  platform: PlatformType;
  lineNo?: number;
  colNo?: number;
  package?: string;
  origAbsPath?: string;
  mapUrl?: string;
  map: string;
  preventCollapse: () => void;
};
