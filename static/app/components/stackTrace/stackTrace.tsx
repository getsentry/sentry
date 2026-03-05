import {StackTraceViewStateProvider} from './stackTraceContext';
import {StackTraceProvider} from './stackTraceProvider';
import type {StackTraceProviderProps, StackTraceViewStateProviderProps} from './types';

type StackTraceProps = Omit<StackTraceProviderProps, 'children'> &
  Pick<
    StackTraceViewStateProviderProps,
    'defaultIsMinified' | 'defaultIsNewestFirst' | 'defaultView'
  >;

export function StackTrace({
  event,
  stacktrace,
  defaultIsMinified,
  defaultIsNewestFirst,
  defaultView,
  ...providerProps
}: StackTraceProps) {
  const hasMinifiedStacktrace = !!providerProps.minifiedStacktrace;

  return (
    <StackTraceViewStateProvider
      defaultView={defaultView}
      defaultIsNewestFirst={defaultIsNewestFirst}
      defaultIsMinified={defaultIsMinified}
      hasMinifiedStacktrace={hasMinifiedStacktrace}
      platform={providerProps.platform ?? event.platform}
    >
      <StackTraceProvider event={event} stacktrace={stacktrace} {...providerProps}>
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    </StackTraceViewStateProvider>
  );
}
