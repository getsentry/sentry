import type {ExceptionValue} from 'sentry/types/event';

export function ExceptionValueFixture(
  props: Partial<ExceptionValue> = {}
): ExceptionValue {
  return {
    mechanism: null,
    rawStacktrace: null,
    stacktrace: null,
    threadId: null,
    type: 'BadError',
    value: 'message',
    module: null,
    ...props,
  };
}
