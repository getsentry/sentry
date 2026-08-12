import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {Count} from 'sentry/components/count';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useReplayCountForIssues} from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import {Divider} from 'sentry/views/issueDetails/divider';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface IssueStatCountsProps {
  group: Group;
  project: Project;
}

/**
 * Inline "N Users · N Events · N Replays" stats for the redesigned header,
 * replacing the tag-style count badges with plain, scannable numbers.
 */
export function IssueStatCounts({group, project}: IssueStatCountsProps) {
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const issueTypeConfig = getConfigForIssueType(group, project);

  const {getReplayCountForIssue} = useReplayCountForIssues({statsPeriod: '90d'});
  const replayCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  if (!issueTypeConfig.eventAndUserCounts.enabled) {
    return null;
  }

  const eventCount = Number(group.count);
  const {userCount} = group;
  const showReplays = issueTypeConfig.pages.replays.enabled && replayCount > 0;

  return (
    <Flex align="center" gap="sm" wrap="wrap">
      <Stat
        to={`${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}user/${location.search}`}
        aria-label={t('View affected users')}
      >
        <Value>
          <Count value={userCount} />
        </Value>
        <StatLabel>{tn('User', 'Users', userCount)}</StatLabel>
      </Stat>
      <Divider />
      <Stat to={`${baseUrl}events/${location.search}`} aria-label={t('View events')}>
        <Value>
          <Count value={eventCount} />
        </Value>
        <StatLabel>{tn('Event', 'Events', eventCount)}</StatLabel>
      </Stat>
      {showReplays && (
        <Fragment>
          <Divider />
          <Stat
            to={`${baseUrl}${TabPaths[Tab.REPLAYS]}${location.search}`}
            aria-label={t("View this issue's replays")}
          >
            <Value>{replayCount > 50 ? '50+' : <Count value={replayCount} />}</Value>
            <StatLabel>{tn('Replay', 'Replays', replayCount)}</StatLabel>
          </Stat>
        </Fragment>
      )}
    </Flex>
  );
}

const Stat = styled(Link)`
  display: inline-flex;
  align-items: baseline;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const Value = styled('span')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
`;

const StatLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;
