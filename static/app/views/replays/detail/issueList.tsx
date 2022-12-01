import {Fragment, useCallback, useEffect, useState} from 'react';
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
import space from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import RequestError from 'sentry/utils/requestError/requestError';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  projectId: string;
  replayId: string;
};
const columns = [t('Issue'), t('Graph'), t('Events'), t('Users')];

type State = {
  fetchError: undefined | RequestError;
  fetching: boolean;
  issues: Group[];
};

function IssueList({projectId, replayId}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints.large})`);
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);

  const [state, setState] = useState<State>({
    fetchError: undefined,
    fetching: true,
    issues: [],
  });

  const fetchIssueData = useCallback(async () => {
    setState(prev => ({
      ...prev,
      fetching: true,
    }));
    try {
      const issues = await api.requestPromise(
        `/organizations/${organization.slug}/issues/`,
        {
          query: {
            // TODO(replays): What about backend issues?
            project: projectId,
            query: `replayId:${replayId}`,
          },
        }
      );
      setState({
        fetchError: undefined,
        fetching: false,
        issues,
      });
    } catch (fetchError) {
      Sentry.captureException(fetchError);
      setState({
        fetchError,
        fetching: false,
        issues: [],
      });
    }
  }, [api, organization.slug, replayId, projectId]);

  useEffect(() => {
    fetchIssueData();
  }, [fetchIssueData]);

  const counts = useReplaysCount({
    groupIds: state.issues.map(issue => issue.id),
    organization,
    project,
  });

  return (
    <ReplayCountContext.Provider value={counts}>
      <StyledPanelTable
        isEmpty={state.issues.length === 0}
        emptyMessage={t('No related Issues found.')}
        isLoading={state.fetching}
        headers={
          isScreenLarge ? columns : columns.filter(column => column !== t('Graph'))
        }
      >
        {state.issues.map(issue => (
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
