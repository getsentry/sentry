export enum EventExtraDataType {
  CRASHED_PROCESS = 'crashed_process',
}

export type EventExtraData = {
  [key: string]: any;
};
