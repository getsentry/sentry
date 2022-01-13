export enum EventExtraDataType {
  CRASHED_PROCESS = 'crashed_process',
}

export interface EventExtraData {
  [key: string]: any;
}
