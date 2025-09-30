import {useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({project_id: replayRecord?.project_id ?? undefined});
  const [isHovered, setIsHovered] = useState(false);
  const {currentTime} = useReplayContext();

  // Create URL with current timestamp for copying
  const replayUrlWithTimestamp = replayRecord
    ? (() => {
        const url = new URL(window.location.href);
        const currentTimeInSeconds = Math.floor(currentTime / 1000);
        url.searchParams.set('t', String(currentTimeInSeconds));
        return url.toString();
      })()
    : '';

  const {onClick: handleCopyReplayLink} = useCopyToClipboard({
    text: replayUrlWithTimestamp,
    successMessage: t('Copied replay link to clipboard'),
  });

  const listPageCrumb = {
    to: {
      pathname: makeReplaysPathname({
        path: '/',
        organization,
      }),
      query: eventView.generateQueryStringObject(),
    },
    label: t('Session Replay'),
  };

  const projectCrumb = {
    to: {
      pathname: makeReplaysPathname({
        path: '/',
        organization,
      }),
      query: {
        ...eventView.generateQueryStringObject(),
        project: replayRecord?.project_id,
      },
    },
    label: project ? (
      <ProjectBadge disableLink project={project} avatarSize={16} />
    ) : null,
  };

  const replayCrumb = {
    label: replayRecord ? (
      <Flex
        align="center"
        gap="xs"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div onClick={handleCopyReplayLink}>{getShortEventId(replayRecord?.id)}</div>
        {isHovered && (
          <Tooltip title={t('Copy link to replay at current timestamp')}>
            <Button
              aria-label={t('Copy link to replay at current timestamp')}
              onClick={handleCopyReplayLink}
              size="zero"
              borderless
              icon={<IconCopy size="xs" color="subText" />}
            />
          </Tooltip>
        )}
      </Flex>
    ) : (
      <Placeholder width="100%" height="16px" />
    ),
  };

  const crumbs = [
    listPageCrumb,
    project ? projectCrumb : null,
    replayRecord ? replayCrumb : null,
  ].filter(defined);

  return <StyledBreadcrumbs crumbs={crumbs} />;
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
`;
