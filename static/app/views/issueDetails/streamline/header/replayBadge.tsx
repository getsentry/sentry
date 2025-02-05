import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import {Divider} from 'sentry/views/issueDetails/divider';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function ReplayBadge({group, project}: {group: Group; project: Project}) {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  if (!issueTypeConfig.pages.replays.enabled || replaysCount <= 0) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <ReplayButton
        type="button"
        priority="link"
        size="zero"
        icon={<IconPlay size="xs" />}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.REPLAYS]}`,
          query: location.query,
          replace: true,
        }}
        aria-label={t("View this issue's replays")}
      >
        {replaysCount > 50
          ? t('50+ Replays')
          : tn('%s Replay', '%s Replays', replaysCount)}
      </ReplayButton>
    </Fragment>
  );
}

const ReplayButton = styled(LinkButton)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
