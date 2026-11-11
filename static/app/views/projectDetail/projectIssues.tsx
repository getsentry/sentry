import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';
import pick from 'lodash/pick';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Pagination, type CursorHandler} from '@sentry/scraps/pagination';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {DiscoverButton} from 'sentry/components/discoverButton';
import {GroupList} from 'sentry/components/issues/groupList';
import {URL_PARAM} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {QueryCount} from 'sentry/components/queryCount';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getPaginationProps} from 'sentry/utils/pagination';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {appendQueryDatasetParam} from 'sentry/views/dashboards/utils';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';
import {NoGroupsHandler} from 'sentry/views/issueList/noGroupsHandler';

enum IssuesType {
  NEW = 'new',
  UNHANDLED = 'unhandled',
  REGRESSED = 'regressed',
  RESOLVED = 'resolved',
  ALL = 'all',
}

const ISSUE_QUERIES = {
  [IssuesType.NEW]: 'is:unresolved is:for_review',
  [IssuesType.UNHANDLED]: 'error.unhandled:true is:unresolved',
  [IssuesType.REGRESSED]: 'regressed_in_release:latest',
  [IssuesType.RESOLVED]: 'is:resolved',
  [IssuesType.ALL]: '',
};

type Props = {
  location: Location;
  organization: Organization;
  projectId: number;
  query?: string;
};

export function ProjectIssues({organization, location, projectId, query = ''}: Props) {
  const [pageLinks, setPageLinks] = useState<string | undefined>();
  const [onCursor, setOnCursor] = useState<CursorHandler | undefined>();
  const [issuesType, setIssuesType] = useQueryState('issuesType', {
    ...parseAsStringLiteral(Object.values(IssuesType)),
    defaultValue: IssuesType.UNHANDLED,
  });
  const {start, end, statsPeriod, environment} = loadQueryParamsFromLocation(
    pageFilterParsers,
    location
  );
  const withSearch = (baseQuery: string, search = query) =>
    [baseQuery, search].join(' ').trim();
  const {data: counts} = useQuery(
    apiOptions.as<Record<string, number | null>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          project: projectId,
          query: Object.values(ISSUE_QUERIES).map(baseQuery => withSearch(baseQuery)),
          ...(!start && {statsPeriod: statsPeriod || DEFAULT_STATS_PERIOD}),
          start: start || undefined,
          end: end || undefined,
          environment,
        },
        staleTime: 0,
      }
    )
  );
  const [lastCounts, setLastCounts] = useState<{
    data: Record<string, number | null>;
    query: string;
  }>();
  if (counts && (counts !== lastCounts?.data || query !== lastCounts.query)) {
    setLastCounts({data: counts, query});
  }

  function handleOpenInIssuesClick() {
    trackAnalytics('project_detail.open_issues', {organization});
  }

  function handleOpenInDiscoverClick() {
    trackAnalytics('project_detail.open_discover', {organization});
  }

  function handleFetchSuccess(groupListState: any, cursorHandler: any) {
    setPageLinks(groupListState.pageLinks);
    setOnCursor(() => cursorHandler);
  }

  const discoverQuery =
    issuesType === 'unhandled'
      ? ['event.type:error error.unhandled:true', query].join(' ').trim()
      : ['event.type:error', query].join(' ').trim();

  function getDiscoverUrl() {
    return {
      pathname: makeDiscoverPathname({
        path: '/results/',
        organization,
      }),
      query: {
        name: t('Frequent Unhandled Issues'),
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        sort: '-count',
        query: discoverQuery,
        display: 'top5',
        ...normalizeDateTimeParams(pick(location.query, Object.values(URL_PARAM))),
        ...appendQueryDatasetParam(organization, SavedQueryDatasets.ERRORS),
      },
    };
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;

  const issueQuery = withSearch(ISSUE_QUERIES[issuesType]);

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

  function renderEmptyMessage() {
    const selectedTimePeriod = start
      ? null
      : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        DEFAULT_RELATIVE_PERIODS[statsPeriod || DEFAULT_STATS_PERIOD];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <NoGroupsHandler
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
    {value: IssuesType.ALL, label: t('All Issues')},
    {value: IssuesType.NEW, label: t('New Issues')},
    {value: IssuesType.UNHANDLED, label: t('Unhandled')},
    {value: IssuesType.REGRESSED, label: t('Regressed')},
    {value: IssuesType.RESOLVED, label: t('Resolved')},
  ];

  return (
    <Fragment>
      <Flex justify="between" align="end" wrap="wrap" marginBottom="md">
        <SegmentedControl
          aria-label={t('Issue type')}
          value={issuesType}
          onChange={setIssuesType}
          size="xs"
        >
          {issuesTypes.map(({value, label}) => (
            <SegmentedControl.Item key={value} textValue={label}>
              {label}&nbsp;
              <QueryCount
                count={
                  lastCounts?.data[withSearch(ISSUE_QUERIES[value], lastCounts.query)] ??
                  0
                }
                max={99}
                hideParens
                hideIfEmpty={false}
              />
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <Grid
          flow="column"
          align="center"
          gap="md"
          marginTop="md"
          width={{zero: '100%', xl: 'auto'}}
        >
          <LinkButton
            data-test-id="issues-open"
            size="xs"
            to={issueSearch}
            onClick={handleOpenInIssuesClick}
          >
            {t('Open in Issues')}
          </LinkButton>
          <DiscoverButton
            onClick={handleOpenInDiscoverClick}
            to={getDiscoverUrl()}
            size="xs"
          >
            {t('Open in Explore')}
          </DiscoverButton>
          <StyledPagination
            {...getPaginationProps(pageLinks)}
            onCursor={onCursor}
            size="xs"
          />
        </Grid>
      </Flex>

      <GroupList
        queryParams={queryParams}
        canSelectGroups={false}
        renderEmptyMessage={renderEmptyMessage}
        withChart={false}
        withPagination={false}
        onFetchSuccess={handleFetchSuccess}
        source="project"
        numPlaceholderRows={queryParams.limit}
      />
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
