import type {ComponentType} from 'react';

import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';

import {NativeDefaultActions} from './frame/actions/nativeDefaultActions';
import {NativeFrameHeader} from './frame/nativeFrameHeader';

interface NativeStackTraceFramesProps {
  /** Removes the outer border, useful for embedding in hovercards. */
  borderless?: boolean;
  /** Replace the default trailing actions for each frame row. */
  frameActionsComponent?: ComponentType<{isHovering: boolean}>;
  /** Replace the default expanded frame context. */
  frameContextComponent?: ComponentType;
}

export function NativeStackTraceFrames({
  borderless = false,
  frameActionsComponent = NativeDefaultActions,
  frameContextComponent = FrameContent,
}: NativeStackTraceFramesProps) {
  return (
    <StackTraceFrames
      borderless={borderless}
      frameActionsComponent={frameActionsComponent}
      frameContextComponent={frameContextComponent}
      frameHeaderComponent={NativeFrameHeader}
    />
  );
}
