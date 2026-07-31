import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import {useNativeDisplayOptionsContext} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
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
  const {absoluteAddresses} = useNativeDisplayOptionsContext();
  const {imageByFrameIndex, maxLengthOfRelativeAddress} = useNativeStackTraceContext();
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
  const canNavigate = isClickable && !!displayAddress;

  const address = (
    <Text
      as="span"
      ellipsis
      monospace
      size="xs"
      variant={canNavigate ? 'accent' : undefined}
    >
      {displayAddress}
    </Text>
  );
  const cell = canNavigate ? (
    <Button
      aria-label={t('Go to images loaded for address %s', displayAddress)}
      size="zero"
      variant="transparent"
      onClick={onClick}
    >
      {address}
    </Button>
  ) : (
    address
  );

  if (!tooltip) {
    return cell;
  }

  return <Tooltip title={tooltip}>{cell}</Tooltip>;
}
