import {useMemo, type ComponentType} from 'react';

import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {isNativePlatform} from 'sentry/utils/platform';

import {FrameContent} from './frame/frameContent';
import {NativeStackTraceFrames} from './native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from './native/nativeStackTraceProvider';
import {createStackTraceRowPolicy} from './rowPolicy';
import {StackTraceFrames} from './stackTraceFrames';
import {StackTraceProvider} from './stackTraceProvider';
import type {StackTraceProviderProps} from './types';

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
  const rowPolicy = useMemo(
    () => createStackTraceRowPolicy({groupingCurrentLevel}),
    [groupingCurrentLevel]
  );

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
    <StackTraceProvider {...props} platform={platform} rowPolicy={rowPolicy}>
      <StackTraceFrames
        borderless={borderless}
        frameActionsComponent={frameActionsComponent}
        frameContextComponent={frameContextComponent}
      />
    </StackTraceProvider>
  );
}
