import type {ExceptionValue as ExceptionValueType} from 'sentry/types';

export function ExceptionValue(
  props: Partial<ExceptionValueType> = {}
): ExceptionValueType {
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
