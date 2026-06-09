import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Image} from 'sentry/types/debugImage';
import type {Frame} from 'sentry/types/event';

import {useGoToImagesLoaded} from './actions/goToImagesLoadedAction';

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

  return;
}

function getRelativeAddress({
  frame,
  image,
  maxLengthOfRelativeAddress,
}: {
  frame: Frame;
  image: Image | null;
  maxLengthOfRelativeAddress: number;
}) {
  if (!image?.image_addr || !frame.instructionAddr) {
    return '';
  }

  const relativeAddress = formatAddress(
    parseAddress(frame.instructionAddr) - parseAddress(image.image_addr),
    maxLengthOfRelativeAddress
  );

  return `+${relativeAddress}`;
}

function getDisplayAddress({
  absoluteAddresses,
  frame,
  image,
  maxLengthOfRelativeAddress,
}: {
  absoluteAddresses: boolean;
  frame: Frame;
  image: Image | null;
  maxLengthOfRelativeAddress: number;
}) {
  const relativeAddress = getRelativeAddress({frame, image, maxLengthOfRelativeAddress});

  if (absoluteAddresses || !relativeAddress) {
    return frame.instructionAddr ?? '';
  }

  return relativeAddress;
}

export function NativeFrameAddress() {
  const {frame, frameIndex, platform} = useStackTraceFrameContext();
  const {frames} = useStackTraceContext();
  const {absoluteAddresses, imageByFrameIndex, maxLengthOfRelativeAddress} =
    useNativeStackTraceContext();
  const {isClickable, onClick} = useGoToImagesLoaded();

  const image = imageByFrameIndex.get(frameIndex) ?? null;
  const prevFrame = frames[frameIndex - 1];

  const inlineFrame = isInlineFrame(frame, prevFrame, platform);
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';

  const displayAddress = getDisplayAddress({
    absoluteAddresses,
    frame,
    image,
    maxLengthOfRelativeAddress,
  });
  const tooltip = getAddressTooltip({inlineFrame, foundByStackScanning});

  const cell = (
    <AddressText
      isClickable={isClickable}
      onClick={
        isClickable
          ? e => {
              e.preventDefault();
              onClick(e);
            }
          : undefined
      }
    >
      {displayAddress}
    </AddressText>
  );

  if (!tooltip) {
    return cell;
  }

  return <Tooltip title={tooltip}>{cell}</Tooltip>;
}

const AddressText = styled('span')<{isClickable: boolean}>`
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  font-style: inherit;
  white-space: nowrap;
  color: ${p =>
    p.isClickable ? p.theme.tokens.interactive.link.accent.rest : 'inherit'};
`;
