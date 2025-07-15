import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
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
