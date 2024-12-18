export enum MessageType {
  SUCCESS = 'success',
  ERROR = 'error',
}

export type TempestCredentials = {
  clientId: string;
  clientSecret: string;
  createdAt: string;
  createdById: number;
  id: number;
  message: string;
  messageType: MessageType;
};
