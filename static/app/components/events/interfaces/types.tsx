export enum SymbolicatorStatus {
  SYMBOLICATED = 'symbolicated',
  MISSING_SYMBOL = 'missing_symbol',
  UNKNOWN_IMAGE = 'unknown_image',
  MISSING = 'missing',
  MALFORMED = 'malformed',
}

export type EventErrorData = {
  message: React.ReactNode;
  type: string;
  data?: {
    image_name?: string;
    image_path?: string;
    message?: string;
    name?: string;
    sdk_time?: string;
    server_time?: string;
    url?: string;
  } & Record<string, any>;
};
