import {StackTraceProvider} from './stackTraceProvider';
import type {StackTraceProviderProps} from './types';

type StackTraceProps = Omit<StackTraceProviderProps, 'children'>;

export function StackTrace({event, stacktrace, ...rootProps}: StackTraceProps) {
  return (
    <StackTraceProvider event={event} stacktrace={stacktrace} {...rootProps}>
      <StackTraceProvider.Toolbar />
      <StackTraceProvider.Frames />
    </StackTraceProvider>
  );
}
