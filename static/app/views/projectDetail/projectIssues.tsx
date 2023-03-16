import {Fragment, useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import GroupList from 'sentry/components/issues/groupList';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import QueryCount from 'sentry/components/queryCount';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';

import NoGroupsHandler from '../issueList/noGroupsHandler';

enum IssuesType {
  NEW = 'new',
  UNHANDLED = 'unhandled',
  REGRESSED = 'regressed',
  RESOLVED = 'resolved',
  ALL = 'all',
}

enum IssuesQuery {
  NEW = 'is:unresolved is:for_review',
  UNHANDLED = 'error.unhandled:true is:unresolved',
  REGRESSED = 'regressed_in_release:latest',
  RESOLVED = 'is:resolved',
  ALL = '',
}

type Count = {
  all: number;
  new: number;
  regressed: number;
  resolved: number;
  unhandled: number;
};

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  projectId: number;
  query?: string;
};

function ProjectIssues({organization, location, projectId, query, api}: Props) {
  const [pageLinks, setPageLinks] = useState<string | undefined>();
  const [onCursor, setOnCursor] = useState<(() => void) | undefined>();
  const [issuesType, setIssuesType] = useState<IssuesType>(
    (location.query.issuesType as IssuesType) || IssuesType.UNHANDLED
  );
  const [issuesCount, setIssuesCount] = useState<Count>({
    all: 0,
    new: 0,
    regressed: 0,
    resolved: 0,
    unhandled: 0,
  });

  const fetchIssuesCount = useCallback(async () => {
    const getIssueCountEndpoint = queryParameters => {
      const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;

      return `${issuesCountPath}?${qs.stringify(queryParameters)}`;
    };
    const params = [
      `${IssuesQuery.NEW}`,
      `${IssuesQuery.ALL}`,
      `${IssuesQuery.RESOLVED}`,
      `${IssuesQuery.UNHANDLED}`,
      `${IssuesQuery.REGRESSED}`,
    ];
    const queryParams = params.map(param => param);
    const queryParameters = {
      project: projectId,
      query: queryParams,
      ...(!location.query.start && {
        statsPeriod: location.query.statsPeriod || DEFAULT_STATS_PERIOD,
      }),
      start: location.query.start,
      end: location.query.end,
      environment: location.query.environment,
      cursor: location.query.cursor,
    };

    const issueCountEndpoint = getIssueCountEndpoint(queryParameters);

    try {
      const data = await api.requestPromise(issueCountEndpoint);
      setIssuesCount({
        all: data[`${IssuesQuery.ALL}`] || 0,
        new: data[`${IssuesQuery.NEW}`] || 0,
        resolved: data[`${IssuesQuery.RESOLVED}`] || 0,
        unhandled: data[`${IssuesQuery.UNHANDLED}`] || 0,
        regressed: data[`${IssuesQuery.REGRESSED}`] || 0,
      });
    } catch {
      // do nothing
    }
  }, [
    api,
    location.query.cursor,
    location.query.end,
    location.query.environment,
    location.query.start,
    location.query.statsPeriod,
    organization.slug,
    projectId,
  ]);
  useEffect(() => {
    fetchIssuesCount();
  }, [fetchIssuesCount]);

  function handleOpenInIssuesClick() {
    trackAdvancedAnalyticsEvent('project_detail.open_issues', {organization});
  }

  function handleOpenInDiscoverClick() {
    trackAdvancedAnalyticsEvent('project_detail.open_discover', {organization});
  }

  function handleFetchSuccess(groupListState, cursorHandler) {
    setPageLinks(groupListState.pageLinks);
    setOnCursor(() => cursorHandler);
  }

  const discoverQuery =
    issuesType === 'unhandled'
      ? ['event.type:error error.unhandled:true', query].join(' ').trim()
      : ['event.type:error', query].join(' ').trim();

  function getDiscoverUrl() {
    return {
      pathname: `/organizations/${organization.slug}/discover/results/`,
      query: {
        name: t('Frequent Unhandled Issues'),
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        sort: ['-count'],
        query: discoverQuery,
        display: 'top5',
        ...normalizeDateTimeParams(pick(location.query, [...Object.values(URL_PARAM)])),
      },
    };
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;

  const issueQuery = (Object.values(IssuesType) as string[]).includes(issuesType)
    ? [`${IssuesQuery[issuesType.toUpperCase()]}`, query].join(' ').trim()
    : [`${IssuesQuery.ALL}`, query].join(' ').trim();

  const queryParams = {
    limit: 5,
    ...normalizeDateTimeParams(
      pick(location.query, [...Object.values(URL_PARAM), 'cursor'])
    ),
    query: issueQuery,
    sort: 'freq',
  };

  const issueSearch = {
    pathname: endpointPath,
    query: queryParams,
  };

  function handleIssuesTypeSelection(issueType: IssuesType) {
    const to = {
      ...location,
      query: {
        ...location.query,
        issuesType: issueType,
      },
    };

    browserHistory.replace(to);
    setIssuesType(issueType);
  }

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start
      ? null
      : DEFAULT_RELATIVE_PERIODS[
          decodeScalar(location.query.statsPeriod, DEFAULT_STATS_PERIOD)
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <NoGroupsHandler
            api={api}
            organization={organization}
            query={issueQuery}
            selectedProjectIds={[projectId]}
            groupIds={[]}
            emptyMessage={tct('No [issuesType] issues for the [timePeriod].', {
              issuesType: issuesType === 'all' ? '' : issuesType,
              timePeriod: displayedPeriod,
            })}
          />
        </PanelBody>
      </Panel>
    );
  }

  const issuesTypes = [
    {value: IssuesType.ALL, label: t('All Issues'), issueCount: issuesCount.all},
    {value: IssuesType.NEW, label: t('New Issues'), issueCount: issuesCount.new},
    {
      value: IssuesType.UNHANDLED,
      label: t('Unhandled'),
      issueCount: issuesCount.unhandled,
    },
    {
      value: IssuesType.REGRESSED,
      label: t('Regressed'),
      issueCount: issuesCount.regressed,
    },
    {
      value: IssuesType.RESOLVED,
      label: t('Resolved'),
      issueCount: issuesCount.resolved,
    },
  ];

  return (
    <Fragment>
      <ControlsWrapper>
        <SegmentedControl
          aria-label={t('Issue type')}
          value={issuesType}
          onChange={value => handleIssuesTypeSelection(value)}
          size="xs"
        >
          {issuesTypes.map(({value, label, issueCount}) => (
            <SegmentedControl.Item key={value} textValue={label}>
              {label}&nbsp;
              <QueryCount count={issueCount} max={99} hideParens hideIfEmpty={false} />
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <OpenInButtonBar gap={1}>
          <Button
            data-test-id="issues-open"
            size="xs"
            to={issueSearch}
            onClick={handleOpenInIssuesClick}
          >
            {t('Open in Issues')}
          </Button>
          <DiscoverButton
            onClick={handleOpenInDiscoverClick}
            to={getDiscoverUrl()}
            size="xs"
          >
            {t('Open in Discover')}
          </DiscoverButton>
          <StyledPagination pageLinks={pageLinks} onCursor={onCursor} size="xs" />
        </OpenInButtonBar>
      </ControlsWrapper>

      <GroupList
        orgId={organization.slug}
        endpointPath={endpointPath}
        queryParams={queryParams}
        query=""
        canSelectGroups={false}
        renderEmptyMessage={renderEmptyMessage}
        withChart={false}
        withPagination={false}
        onFetchSuccess={handleFetchSuccess}
        source="project"
      />
    </Fragment>
  );
}

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  flex-wrap: wrap;
`;

const OpenInButtonBar = styled(ButtonBar)`
  margin-top: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

export default ProjectIssues;
