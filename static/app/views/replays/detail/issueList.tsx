import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {PanelTable} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {DEFAULT_STREAM_GROUP_STATS_PERIOD} from 'sentry/components/stream/group';
import GroupChart from 'sentry/components/stream/groupChart';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, NewQuery, PageFilters} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

type Props = {
  projectId: string;
  replayId: string;
  selection: PageFilters;
};
const columns = [t('Issue'), t('Graph'), t('Events'), t('Users')];

function IssueList(props: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[2]})`);

  const [issuesById, setIssuesById] = useState<Record<string, Group>>({});
  const [issueStatsById, setIssuesStatsById] = useState<Record<string, Group>>({});

  const getEventView = () => {
    const {selection} = props;
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: ['count(issue)', 'issue'],
      environment: selection.environments,
      projects: selection.projects,
      query: `replayId:${props.replayId} AND event.type:error`,
    };
    const result = EventView.fromNewQueryWithLocation(eventQueryParams, location);
    return result;
  };

  const fetchIssueData = useCallback(async () => {
    let issues;
    try {
      issues = await api.requestPromise(`/organizations/${organization.slug}/issues/`, {
        includeAllArgs: true,
        query: {
          project: props.projectId,
          query: `replayId:${props.replayId}`,
        },
      });

      setIssuesById(keyBy(issues[0], 'id'));
    } catch (error) {
      setIssuesById({});
      return;
    }

    try {
      const issuesResults = await api.requestPromise(
        `/organizations/${organization.slug}/issues-stats/`,
        {
          includeAllArgs: true,
          query: {
            project: props.projectId,
            groups: issues[0]?.map(issue => issue.id),
            query: `replayId:${props.replayId}`,
          },
        }
      );
      setIssuesStatsById(keyBy(issuesResults[0], 'id'));
    } catch (error) {
      setIssuesStatsById({});
    }
  }, [api, organization.slug, props.replayId, props.projectId]);

  useEffect(() => {
    fetchIssueData();
  }, [fetchIssueData]);

  const renderTableRow = error => {
    const matchedIssue = issuesById[error['issue.id']];
    const matchedIssueStats = issueStatsById[error['issue.id']];

    if (!matchedIssue) {
      return null;
    }
    return (
      <Fragment key={matchedIssue.id}>
        <IssueDetailsWrapper>
          <EventOrGroupHeader
            includeLink
            data={matchedIssue}
            organization={organization}
            size="normal"
          />
          <EventOrGroupExtraDetails
            data={{
              ...matchedIssue,
              firstSeen: matchedIssueStats?.firstSeen || '',
              lastSeen: matchedIssueStats?.lastSeen || '',
            }}
          />
        </IssueDetailsWrapper>
        {isScreenLarge && (
          <ChartWrapper>
            {matchedIssueStats?.stats ? (
              <GroupChart
                statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                data={matchedIssueStats}
                showSecondaryPoints
                showMarkLine
              />
            ) : (
              <Placeholder height="44px" />
            )}
          </ChartWrapper>
        )}

        <Item>
          {matchedIssueStats?.count ? (
            matchedIssueStats?.count
          ) : (
            <Placeholder height="24px" />
          )}
        </Item>

        <Item>
          {matchedIssueStats?.userCount ? (
            matchedIssueStats?.userCount
          ) : (
            <Placeholder height="24px" />
          )}
        </Item>
      </Fragment>
    );
  };

  return (
    <DiscoverQuery
      eventView={getEventView()}
      location={location}
      orgSlug={organization.slug}
      limit={15}
    >
      {data => {
        return (
          <StyledPanelTable
            isEmpty={data.tableData?.data.length === 0}
            emptyMessage={t('No related Issues found.')}
            isLoading={data.isLoading}
            headers={
              isScreenLarge ? columns : columns.filter(column => column !== t('Graph'))
            }
          >
            {data.tableData?.data.map(renderTableRow) || null}
          </StyledPanelTable>
        );
      }}
    </DiscoverQuery>
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

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: minmax(0, 1fr) repeat(2, max-content);
  }
`;

export default withPageFilters(IssueList);
