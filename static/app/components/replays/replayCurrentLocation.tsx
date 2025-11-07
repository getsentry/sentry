import {Flex} from '@sentry/scraps/layout/flex';
import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayCurrentLocationPicker from 'sentry/components/replays/replayCurrentLocationPicker';
import {IconFatal} from 'sentry/icons/iconFatal';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import ReplayViewScale from 'sentry/views/replays/detail/replayViewScale';

interface Props {
  isLoading: boolean;
}

export default function ReplayCurrentLocation({isLoading}: Props) {
  const replay = useReplayReader();
  const isVideoReplay = replay?.isVideoReplay();

  return (
    <Flex align="center" flex="1" gap="sm" justify="between" radius="md">
      <ReplayCurrentLocationPicker />
      <ErrorBoundary customComponent={FatalIconTooltip}>
        <BrowserOSIcons showBrowser={!isVideoReplay} isLoading={isLoading} />
      </ErrorBoundary>
      <ErrorBoundary customComponent={FatalIconTooltip}>
        <ReplayViewScale isLoading={isLoading} />
      </ErrorBoundary>
    </Flex>
  );
}

function FatalIconTooltip({error}: {error: Error | null}) {
  return (
    <Tooltip skipWrapper title={error?.message}>
      <IconFatal size="sm" />
    </Tooltip>
  );
}
