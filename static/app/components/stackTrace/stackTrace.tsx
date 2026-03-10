import {FrameContext} from './frame/frameContext';
import {StackTraceViewStateProvider} from './stackTraceContext';
import {StackTraceFrames} from './stackTraceFrames';
import {StackTraceProvider} from './stackTraceProvider';
import {Toolbar} from './toolbar';
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
        <Toolbar />
        <StackTraceFrames frameContextComponent={FrameContext} />
      </StackTraceProvider>
    </StackTraceViewStateProvider>
  );
}
