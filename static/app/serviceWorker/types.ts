import type {AutofixStartStepData} from 'sentry/serviceWorker/worker/handleAutofixStartStep';

/**
 * The base type for all Event* types.
 *
 * This includes the `type` field, which is required for narrowing.
 */
interface EventMessageBase {
  name: string;
  type: 'event';
}

interface PingEventMessage extends EventMessageBase {
  name: 'ping';
}
interface AutofixStartStepEventMessage extends EventMessageBase {
  data: AutofixStartStepData;
  name: 'autofix.startStep';
}

export type EventMessage = PingEventMessage | AutofixStartStepEventMessage;

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

/**
 * The base type for all Request* types.
 *
 * This includes the `type` field, which is required for narrowing, and the
 * `timeoutMs` field, which is an optional wait time for a response.
 */
interface RequestMessageBase {
  name: string;
  type: 'request';
  timeoutMs?: number; // How long to wait for a response, default 10 seconds
}

interface TriggerTestNotificationRequestMessage extends RequestMessageBase {
  data: {
    options: AllNotificationOptions;
    title: string;
  };
  name: 'trigger.test-notification';
}

export type RequestMessage = TriggerTestNotificationRequestMessage;

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
