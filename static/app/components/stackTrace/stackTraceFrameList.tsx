import type {ComponentType} from 'react';

import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {createStackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceProviderProps} from 'sentry/components/stackTrace/types';
import {isNativePlatform} from 'sentry/utils/platform';

export interface StackTraceFrameListProps extends Omit<
  StackTraceProviderProps,
  'children' | 'rowPolicy'
> {
  borderless?: boolean;
  frameActionsComponent?: ComponentType<{isHovering: boolean}>;
  frameContextComponent?: ComponentType;
  groupingCurrentLevel?: number;
}

/** Renders either frame layout under the same view-state provider. */
export function StackTraceFrameList({
  borderless,
  frameActionsComponent,
  frameContextComponent = FrameContent,
  groupingCurrentLevel,
  ...props
}: StackTraceFrameListProps) {
  const platform = props.platform ?? getStacktracePlatform(props.event, props.stacktrace);

  if (isNativePlatform(platform)) {
    return (
      <NativeStackTraceProvider
        {...props}
        platform={platform}
        groupingCurrentLevel={groupingCurrentLevel}
      >
        <NativeStackTraceFrames
          borderless={borderless}
          frameActionsComponent={frameActionsComponent}
          frameContextComponent={frameContextComponent}
        />
      </NativeStackTraceProvider>
    );
  }

  return (
    <StackTraceProvider
      {...props}
      platform={platform}
      rowPolicy={createStackTraceRowPolicy({groupingCurrentLevel})}
    >
      <StackTraceFrames
        borderless={borderless}
        frameActionsComponent={frameActionsComponent}
        frameContextComponent={frameContextComponent}
      />
    </StackTraceProvider>
  );
}
