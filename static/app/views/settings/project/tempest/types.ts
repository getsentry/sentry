export enum MessageType {
  SUCCESS = 'success',
  ERROR = 'error',
}

export type TempestCredentials = {
  clientId: string;
  clientSecret: string;
  createdByEmail: string;
  createdById: number;
  dateAdded: string;
  dateUpdated: string;
  id: number;
  message: string;
  messageType: MessageType;
};
