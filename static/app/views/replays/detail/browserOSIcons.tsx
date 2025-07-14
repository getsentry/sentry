import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {space} from 'sentry/styles/space';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';

export default function BrowserOSIcons({
  showBrowser = true,
  isLoading,
}: {
  isLoading?: boolean;
  showBrowser?: boolean;
}) {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  const icon = generatePlatformIconName(
    replayRecord?.browser.name ?? '',
    replayRecord?.browser.version ?? undefined
  );

  return isLoading ? (
    <Placeholder width="50px" height="32px" />
  ) : (
    <Flex direction="row-reverse">
      <Tooltip title={`${replayRecord?.os.name ?? ''} ${replayRecord?.os.version ?? ''}`}>
        <PlatformIcon platform={icon} size="20px" />
      </Tooltip>
      {showBrowser && (
        <Overlap>
          <Tooltip
            title={`${replayRecord?.browser.name ?? ''} ${
              replayRecord?.browser.version ?? ''
            }`}
          >
            <PlatformIcon platform={icon} size="20px" />
          </Tooltip>
        </Overlap>
      )}
    </Flex>
  );
}

const Overlap = styled('div')`
  margin-right: -${space(0.75)};
  z-index: 1;
`;
