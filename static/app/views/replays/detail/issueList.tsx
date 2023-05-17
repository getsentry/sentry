import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {PanelTable} from 'sentry/components/panels';
import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import {DEFAULT_STREAM_GROUP_STATS_PERIOD} from 'sentry/components/stream/group';
import GroupChart from 'sentry/components/stream/groupChart';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  projectId: string;
  replayId: string;
};
const columns = [t('Issue'), t('Graph'), t('Events'), t('Users')];

function IssueList({projectId, replayId}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints.large})`);

  const url = `/organizations/${organization.slug}/issues/`;
  const query = {
    query: `replayId:${replayId}`,
  };

  const {
    data: issues = [],
    isLoading,
    isError,
    error,
  } = useQuery<Group[], RequestError>({
    queryKey: [url, query],
    queryFn: () =>
      api.requestPromise(url, {
        query,
        headers: {
          'x-sentry-replay-request': '1',
        },
      }),
  });

  useEffect(() => {
    if (!isError) {
      return;
    }
    Sentry.captureException(error);
  }, [isError, error]);

  const counts = useReplaysCount({
    groupIds: issues.map(issue => issue.id),
    organization,
  });

  return (
    <ReplayCountContext.Provider value={counts}>
      <StyledPanelTable
        isEmpty={issues.length === 0}
        emptyMessage={t('No Issues are related')}
        isLoading={isLoading}
        headers={
          isScreenLarge ? columns : columns.filter(column => column !== t('Graph'))
        }
      >
        {issues
          // prioritize the replay issues for the project first, followed by first_seen
          .sort((a, b) => {
            if (a.project.id === projectId) {
              if (a.project.id === b.project.id) {
                return new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime();
              }

              return -1;
            }
            return 1;
          })
          .map(issue => (
            <TableRow
              key={issue.id}
              isScreenLarge={isScreenLarge}
              issue={issue}
              organization={organization}
            />
          )) || null}
      </StyledPanelTable>
    </ReplayCountContext.Provider>
  );
}

function TableRow({
  isScreenLarge,
  issue,
  organization,
}: {
  isScreenLarge: boolean;
  issue: Group;
  organization: Organization;
}) {
  return (
    <Fragment>
      <IssueDetailsWrapper>
        <EventOrGroupHeader
          includeLink
          data={issue}
          organization={organization}
          size="normal"
          source="replay"
        />
        <EventOrGroupExtraDetails data={issue} />
      </IssueDetailsWrapper>
      {isScreenLarge && (
        <ChartWrapper>
          <GroupChart
            statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
            data={issue}
            showSecondaryPoints
            showMarkLine
          />
        </ChartWrapper>
      )}
      <Item>{issue.count}</Item>
      <Item>{issue.userCount}</Item>
    </Fragment>
  );
}
const ChartWrapper = styled('div')`
  width: 200px;
  margin-left: -${space(2)};
  padding-left: ${space(0)};
`;

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

const IssueDetailsWrapper = styled('div')`
  overflow: hidden;
  line-height: normal;
`;

const StyledPanelTable = styled(PanelTable)`
  /* overflow: visible allows the tooltip to be completely shown */
  overflow: visible;
  grid-template-columns: minmax(1fr, max-content) repeat(3, max-content);

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) repeat(2, max-content);
  }
`;

export default IssueList;
