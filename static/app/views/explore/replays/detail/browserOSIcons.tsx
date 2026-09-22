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
        <ContentWidthDescriptionList gap="md 2xl">
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
        </ContentWidthDescriptionList>
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

// The tooltip is portalled into the replay video panel, so its overlay can only
// shrink-to-fit the space left of that panel's edge. Sizing the list to its own
// content makes the overlay grow to match instead of clipping the versions.
const ContentWidthDescriptionList = styled(DescriptionList)`
  width: max-content;
`;

const Overlap = styled('div')`
  margin-right: -${p => p.theme.space.sm};
  z-index: 1;
`;
