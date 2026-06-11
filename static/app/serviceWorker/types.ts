export interface InitSentryMessage {
  dsn: string;
  type: 'init-sentry';
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

export type WorkerMessage = InitSentryMessage;
