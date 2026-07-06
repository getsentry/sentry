import type {Config} from 'sentry/types/system';

export type EventMessage =
  | {
      initialData: Config;
      name: 'worker.init';
      sentryVersion: string | undefined;
      type: 'event';
    }
  | {
      name: 'user.login';
      type: 'event';
      userIdentity: Config['userIdentity'];
    }
  | {
      name: 'user.logout';
      type: 'event';
    };

/**
 * The web `NotificationOptions` type only covers the widely-supported fields.
 * Chrome additionally supports `image` (a large hero image) and `renotify`, so
 * we widen the type to allow configuring them from the notification tester.
 */
export type TestNotificationOptions = NotificationOptions & {
  actions?: Array<{
    action: string;
    title: string;
  }>;
  image?: string;
  renotify?: boolean;
};

export type RequestMessage = {
  data: {
    options: TestNotificationOptions;
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
