import type {AutofixStartStepData} from 'sentry/serviceWorker/worker/handleAutofixStartStep';

export type EventMessage =
  | {
      name: 'ping';
      type: 'event';
    }
  | {
      data: AutofixStartStepData;
      name: 'autofix.startStep';
      type: 'event';
    };

/**
 * The web `NotificationOptions` type only covers the widely-supported fields.
 * Chrome additionally supports `image` (a large hero image) and `renotify`, so
 * we widen the type to allow configuring them from the notification tester.
 */
export type AllNotificationOptions = NotificationOptions & {
  actions?: Array<{
    action: string;
    title: string;
  }>;
  image?: string;
  renotify?: boolean;
};

export type RequestMessage = {
  data: {
    options: AllNotificationOptions;
    title: string;
  };
  name: 'trigger.test-notification';
  type: 'request';
};

export type ResponseMessage =
  | {
      data: unknown;
      messageId: string;
      type: 'response';
    }
  | {
      error: unknown;
      messageId: string;
      type: 'response';
    };
