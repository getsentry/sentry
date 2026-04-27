import {useMemo, useState} from 'react';

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

  const [absoluteAddresses, setAbsoluteAddresses] = useState(false);
  const [absoluteFilePaths, setAbsoluteFilePaths] = useState(false);
  const [verboseFunctionNames, setVerboseFunctionNames] = useState(false);

  const {
    imageByFrameIndex,
    maxLengthOfRelativeAddress,
    hasAnyStatusIcons,
    hasAbsoluteAddresses,
    hasAbsoluteFilePaths,
    hasVerboseFunctionNames,
  } = useMemo(() => {
    const frames = stacktrace.frames ?? [];
    const map = new Map<number, ImageWithCombinedStatus | null>();
    let maxLen = 0;
    let anyIcon = false;
    let anyAddr = false;
    let anyAbsPath = false;
    let anyVerbose = false;

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
      if (!anyAddr && !!frame.instructionAddr) {
        anyAddr = true;
      }
      if (
        !anyAbsPath &&
        !!frame.filename &&
        !!frame.absPath &&
        frame.filename !== frame.absPath
      ) {
        anyAbsPath = true;
      }
      if (
        !anyVerbose &&
        !!frame.function &&
        !!frame.rawFunction &&
        frame.function !== frame.rawFunction
      ) {
        anyVerbose = true;
      }
    }

    return {
      imageByFrameIndex: map,
      maxLengthOfRelativeAddress: maxLen,
      hasAnyStatusIcons: anyIcon,
      hasAbsoluteAddresses: anyAddr,
      hasAbsoluteFilePaths: anyAbsPath,
      hasVerboseFunctionNames: anyVerbose,
    };
  }, [event, stacktrace.frames]);

  const value = useMemo<NativeStackTraceContextValue>(
    () => ({
      absoluteAddresses,
      absoluteFilePaths,
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
      setAbsoluteAddresses,
      setAbsoluteFilePaths,
      setVerboseFunctionNames,
      verboseFunctionNames,
    }),
    [
      absoluteAddresses,
      absoluteFilePaths,
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
      verboseFunctionNames,
    ]
  );

  return (
    <StackTraceProvider {...stackTraceProps}>
      <NativeStackTraceContext.Provider value={value}>
        {children}
      </NativeStackTraceContext.Provider>
    </StackTraceProvider>
  );
}
