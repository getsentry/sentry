import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';

import {useGoToImagesLoaded} from './actions/goToImagesLoadedAction';

interface NativeFrameAddressProps {
  /** When true, render absolute instruction address instead of relative offset. */
  absolute?: boolean;
}

function isInlineFrame(frame: Frame, prevFrame: Frame | undefined, platform: string) {
  if (!prevFrame) {
    return false;
  }
  const framePlatform = frame.platform ?? platform;
  const prevPlatform = prevFrame.platform ?? platform;
  return (
    framePlatform === prevPlatform &&
    !!frame.instructionAddr &&
    frame.instructionAddr === prevFrame.instructionAddr
  );
}

function getAddressTooltip({
  inlineFrame,
  foundByStackScanning,
}: {
  foundByStackScanning: boolean;
  inlineFrame: boolean;
}) {
  if (inlineFrame && foundByStackScanning) {
    return t('Inline frame, found by stack scanning');
  }
  if (inlineFrame) {
    return t('Inline frame');
  }
  if (foundByStackScanning) {
    return t('Found by stack scanning');
  }
  return undefined;
}

export function NativeFrameAddress({absolute = false}: NativeFrameAddressProps) {
  const {frame, frameIndex, platform} = useStackTraceFrameContext();
  const {frames} = useStackTraceContext();
  const {imageByFrameIndex, maxLengthOfRelativeAddress} = useNativeStackTraceContext();
  const {isClickable, onClick} = useGoToImagesLoaded();

  const image = imageByFrameIndex.get(frameIndex) ?? null;
  const prevFrame = frames[frameIndex - 1];

  const inlineFrame = isInlineFrame(frame, prevFrame, platform);
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';

  const startingAddress = image?.image_addr ?? null;
  const relative = startingAddress
    ? `+${formatAddress(
        parseAddress(frame.instructionAddr) - parseAddress(startingAddress),
        maxLengthOfRelativeAddress
      )}`
    : '';

  const display = !relative || absolute ? (frame.instructionAddr ?? '') : relative;
  const tooltip = getAddressTooltip({inlineFrame, foundByStackScanning});

  const cell = (
    <Text
      as="span"
      monospace
      size="xs"
      variant={isClickable ? 'accent' : undefined}
      onClick={
        isClickable
          ? e => {
              e.preventDefault();
              onClick(e);
            }
          : undefined
      }
    >
      {display}
    </Text>
  );

  if (!tooltip) {
    return cell;
  }

  return <Tooltip title={tooltip}>{cell}</Tooltip>;
}
