import {useMemo} from 'react';

import {
  findImageForAddress,
  parseAddress,
} from 'sentry/components/events/interfaces/utils';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceProviderProps} from 'sentry/components/stackTrace/types';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

import {
  getSymbolicatorStatus,
  hasStatusIcon,
} from './frame/actions/getSymbolicatorStatus';
import {
  NativeStackTraceContext,
  type NativeStackTraceContextValue,
} from './nativeStackTraceContext';

interface NativeStackTraceProviderProps extends StackTraceProviderProps {
  isHoverPreviewed?: boolean;
}

export function NativeStackTraceProvider({
  children,
  isHoverPreviewed = false,
  ...stackTraceProps
}: NativeStackTraceProviderProps) {
  const {event, stacktrace} = stackTraceProps;

  const {imageByFrameIndex, maxLengthOfRelativeAddress, hasAnyStatusIcons} =
    useMemo(() => {
      const frames = stacktrace.frames ?? [];
      const map = new Map<number, ImageWithCombinedStatus | null>();
      let maxLen = 0;
      let anyIcon = false;

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]!;
        const image = findImageForAddress({
          event,
          addrMode: frame.addrMode,
          address: frame.instructionAddr,
        }) as ImageWithCombinedStatus | null;
        map.set(i, image ?? null);

        if (image?.image_addr && frame.instructionAddr) {
          const relative = (
            parseAddress(frame.instructionAddr) - parseAddress(image.image_addr)
          ).toString(16);
          if (relative.length > maxLen) {
            maxLen = relative.length;
          }
        }

        if (!anyIcon && hasStatusIcon(getSymbolicatorStatus(frame, image ?? null))) {
          anyIcon = true;
        }
      }

      return {
        imageByFrameIndex: map,
        maxLengthOfRelativeAddress: maxLen,
        hasAnyStatusIcons: anyIcon,
      };
    }, [event, stacktrace.frames]);

  const value = useMemo<NativeStackTraceContextValue>(
    () => ({
      hasAnyStatusIcons,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
    }),
    [hasAnyStatusIcons, imageByFrameIndex, isHoverPreviewed, maxLengthOfRelativeAddress]
  );

  return (
    <StackTraceProvider {...stackTraceProps}>
      <NativeStackTraceContext.Provider value={value}>
        {children}
      </NativeStackTraceContext.Provider>
    </StackTraceProvider>
  );
}
