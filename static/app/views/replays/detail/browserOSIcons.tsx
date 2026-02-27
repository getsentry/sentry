import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import Placeholder from 'sentry/components/placeholder';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export default function BrowserOSIcons({
  showBrowser = true,
  isLoading,
}: {
  isLoading?: boolean;
  showBrowser?: boolean;
}) {
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();

  if (isLoading) {
    return <Placeholder width="34px" height="20px" />;
  }

  if (!replayRecord) {
    return (
      <Tooltip title={t('Unknown Device')}>
        <PlatformIcon platform="unknown" size="20px" />
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        <CountTooltipContent>
          {showBrowser && (
            <Fragment>
              <dt>{t('Browser:')}</dt>
              <dd>{`${replayRecord?.browser.name ?? ''} ${replayRecord?.browser.version ?? ''}`}</dd>
            </Fragment>
          )}
          <dt>{t('OS:')}</dt>
          <dd>
            {replayRecord?.os.name ?? ''} {replayRecord?.os.version ?? ''}
          </dd>
        </CountTooltipContent>
      }
    >
      <Flex>
        {showBrowser && (
          <Overlap>
            <PlatformIcon
              platform={generatePlatformIconName(
                replayRecord?.browser.name ?? '',
                replayRecord?.browser.version ?? undefined
              )}
              size="20px"
            />
          </Overlap>
        )}
        <PlatformIcon
          platform={generatePlatformIconName(
            replayRecord?.os.name ?? '',
            replayRecord?.os.version ?? undefined
          )}
          size="20px"
        />
      </Flex>
    </Tooltip>
  );
}

const Overlap = styled('div')`
  margin-right: -${space(0.75)};
  z-index: 1;
`;
