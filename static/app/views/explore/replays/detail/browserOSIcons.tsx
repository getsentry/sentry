import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export function BrowserOSIcons({
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
        <NoWrapDescriptionList gap="md 2xl">
          {showBrowser && (
            <Fragment>
              <DescriptionList.Term>{t('Browser')}</DescriptionList.Term>
              <DescriptionList.Details>
                {replayRecord?.browser.name ?? ''} {replayRecord?.browser.version ?? ''}
              </DescriptionList.Details>
            </Fragment>
          )}
          <DescriptionList.Term>{t('OS')}</DescriptionList.Term>
          <DescriptionList.Details>
            {replayRecord?.os.name ?? ''} {replayRecord?.os.version ?? ''}
          </DescriptionList.Details>
        </NoWrapDescriptionList>
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

// The replay video panel squeezes this tooltip narrow enough that a browser name
// would otherwise break away from its version.
const NoWrapDescriptionList = styled(DescriptionList)`
  white-space: nowrap;
`;

const Overlap = styled('div')`
  margin-right: -${p => p.theme.space.sm};
  z-index: 1;
`;
