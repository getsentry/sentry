import {
  findImageForAddress,
  parseAddress,
} from 'sentry/components/events/interfaces/utils';
import type {Image} from 'sentry/types/debugImage';
import type {Event, Frame} from 'sentry/types/event';

import {getSymbolicatorStatus} from './frame/actions/getSymbolicatorStatus';

export function getNativeFrameCapabilities(frames: Frame[]) {
  return {
    hasAbsoluteAddresses: frames.some(frame => !!frame.instructionAddr),
    hasAbsoluteFilePaths: frames.some(
      frame => !!frame.filename && !!frame.absPath && frame.filename !== frame.absPath
    ),
    hasVerboseFunctionNames: frames.some(
      frame =>
        !!frame.function && !!frame.rawFunction && frame.function !== frame.rawFunction
    ),
  };
}

export function analyzeNativeFrames({event, frames}: {event: Event; frames: Frame[]}) {
  const imageByFrameIndex = new Map<number, Image | null>();
  let maxLengthOfRelativeAddress = 0;
  let hasAnyStatusIcons = false;

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
  }

  return {
    ...getNativeFrameCapabilities(frames),
    hasAnyStatusIcons,
    imageByFrameIndex,
    maxLengthOfRelativeAddress,
  };
}
