import {
  findImageForAddress,
  parseAddress,
} from 'sentry/components/events/interfaces/utils';
import type {Image} from 'sentry/types/debugImage';
import type {Event, Frame} from 'sentry/types/event';

import {getSymbolicatorStatus} from './frame/actions/getSymbolicatorStatus';

interface NativeFrameAnalysis {
  hasAbsoluteAddresses: boolean;
  hasAbsoluteFilePaths: boolean;
  hasAnyStatusIcons: boolean;
  hasVerboseFunctionNames: boolean;
  imageByFrameIndex: Map<number, Image | null>;
  maxLengthOfRelativeAddress: number;
}

export function analyzeNativeFrames({
  event,
  frames,
}: {
  event: Event;
  frames: Frame[];
}): NativeFrameAnalysis {
  const imageByFrameIndex = new Map<number, Image | null>();
  let maxLengthOfRelativeAddress = 0;
  let hasAnyStatusIcons = false;
  let hasAbsoluteAddresses = false;
  let hasAbsoluteFilePaths = false;
  let hasVerboseFunctionNames = false;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const image = findImageForAddress({
      event,
      addrMode: frame.addrMode,
      address: frame.instructionAddr,
    });
    imageByFrameIndex.set(i, image ?? null);

    if (image?.image_addr && frame.instructionAddr) {
      const relative = (
        parseAddress(frame.instructionAddr) - parseAddress(image.image_addr)
      ).toString(16);
      maxLengthOfRelativeAddress = Math.max(maxLengthOfRelativeAddress, relative.length);
    }

    hasAnyStatusIcons =
      hasAnyStatusIcons || getSymbolicatorStatus(frame, image ?? null) !== null;
    hasAbsoluteAddresses = hasAbsoluteAddresses || !!frame.instructionAddr;
    hasAbsoluteFilePaths =
      hasAbsoluteFilePaths ||
      (!!frame.filename && !!frame.absPath && frame.filename !== frame.absPath);
    hasVerboseFunctionNames =
      hasVerboseFunctionNames ||
      (!!frame.function && !!frame.rawFunction && frame.function !== frame.rawFunction);
  }

  return {
    hasAbsoluteAddresses,
    hasAbsoluteFilePaths,
    hasAnyStatusIcons,
    hasVerboseFunctionNames,
    imageByFrameIndex,
    maxLengthOfRelativeAddress,
  };
}
