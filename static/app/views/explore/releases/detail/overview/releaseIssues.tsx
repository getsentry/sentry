import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {LinkButton} from '@sentry/scraps/button';
import {Grid, type GridProps} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {GroupList} from 'sentry/components/issues/groupList';
import {QueryCount} from 'sentry/components/queryCount';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EmptyState} from 'sentry/views/explore/releases/detail/commitsAndFiles/emptyState';
import type {ReleaseBounds} from 'sentry/views/explore/releases/utils';
import {getReleaseParams} from 'sentry/views/explore/releases/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

enum IssuesType {
  NEW = 'new',
  UNHANDLED = 'unhandled',
  REGRESSED = 'regressed',
  RESOLVED = 'resolved',
  ALL = 'all',
}

const issuesQuery: Record<IssuesType, string> = {
  [IssuesType.NEW]: 'first-release',
  [IssuesType.UNHANDLED]: 'error.handled:0',
  [IssuesType.REGRESSED]: 'regressed_in_release',
  [IssuesType.RESOLVED]: 'is:resolved',
  [IssuesType.ALL]: 'release',
};

type IssuesQueryParams = {
  limit: number;
  query: string;
  sort: string;
};

interface Props {
  releaseBounds: ReleaseBounds;
  version: string;
  queryFilterDescription?: string;
  withChart?: boolean;
}

function getActiveIssuesType(location: ReturnType<typeof useLocation>): IssuesType {
  const query = (location.query?.issuesType as string) ?? '';
  return Object.values<string>(IssuesType).includes(query)
    ? (query as IssuesType)
    : IssuesType.NEW;
}

function getIssuesEndpoint(
  version: string,
  location: ReturnType<typeof useLocation>,
  releaseBounds: ReleaseBounds,
  issuesType: IssuesType
): {
  endpoint: React.ComponentProps<typeof GroupList>['endpoint'];
  queryParams: IssuesQueryParams;
} {
  const queryParams = {
    ...getReleaseParams({
      location,
      releaseBounds,
    }),
    limit: 10,
    sort: IssueSortOptions.FREQ,
    groupStatsPeriod: 'auto',
  };

  switch (issuesType) {
    case IssuesType.ALL:
      return {
        endpoint: {
          path: '/organizations/$organizationIdOrSlug/issues/',
        },
        queryParams: {
          ...queryParams,
          query: new MutableSearch([
            `${issuesQuery.all}:${version}`,
            'is:unresolved',
          ]).formatString(),
        },
      };
    case IssuesType.RESOLVED:
      return {
        endpoint: {
          path: '/organizations/$organizationIdOrSlug/releases/$version/resolved/',
          version,
        },
        queryParams: {...queryParams, query: ''},
      };
    case IssuesType.UNHANDLED:
      return {
        endpoint: {
          path: '/organizations/$organizationIdOrSlug/issues/',
        },
        queryParams: {
          ...queryParams,
          query: new MutableSearch([
            `${issuesQuery.all}:${version}`,
            issuesQuery.unhandled,
            'is:unresolved',
          ]).formatString(),
        },
      };
    case IssuesType.REGRESSED:
      return {
        endpoint: {
          path: '/organizations/$organizationIdOrSlug/issues/',
        },
        queryParams: {
          ...queryParams,
          query: new MutableSearch([
            `${issuesQuery.regressed}:${version}`,
          ]).formatString(),
        },
      };
    case IssuesType.NEW:
    default:
      return {
        endpoint: {
          path: '/organizations/$organizationIdOrSlug/issues/',
        },
        queryParams: {
          ...queryParams,
          query: new MutableSearch([
            `${issuesQuery.new}:${version}`,
            'is:unresolved',
          ]).formatString(),
        },
      };
  }
}

function getIssuesUrl(
  version: string,
  location: ReturnType<typeof useLocation>,
  releaseBounds: ReleaseBounds,
  issuesType: IssuesType,
  organizationSlug: string
) {
  const {queryParams} = getIssuesEndpoint(version, location, releaseBounds, issuesType);
  const query = new MutableSearch([]);

  switch (issuesType) {
    case IssuesType.NEW:
      query.setFilterValues('firstRelease', [version]);
      break;
    case IssuesType.UNHANDLED:
      query.setFilterValues('release', [version]);
      query.setFilterValues('error.handled', ['0']);
      break;
    case IssuesType.REGRESSED:
      query.setFilterValues('regressed_in_release', [version]);
      break;
    case IssuesType.RESOLVED:
    case IssuesType.ALL:
    default:
      query.setFilterValues('release', [version]);
  }

  return {
    pathname: `/organizations/${organizationSlug}/issues/`,
    query: {
      ...queryParams,
      limit: undefined,
      cursor: undefined,
      query: query.formatString(),
    },
  };
}

export function ReleaseIssues({
  releaseBounds,
  version,
  queryFilterDescription,
  withChart = false,
}: Props) {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  const [count, setCount] = useState<{
    all: number | null;
    new: number | null;
    regressed: number | null;
    resolved: number | null;
    unhandled: number | null;
  }>({
    new: null,
    all: null,
    resolved: null,
    unhandled: null,
    regressed: null,
  });
  const [pageLinks, setPageLinks] = useState<string | undefined>();
  const [onCursor, setOnCursor] = useState<(() => void) | undefined>();

  const issuesType = getActiveIssuesType(location);
  const {endpoint, queryParams} = getIssuesEndpoint(
    version,
    location,
    releaseBounds,
    issuesType
  );

  const releaseParams = useMemo(
    () => getReleaseParams({location, releaseBounds}),
    [location, releaseBounds]
  );
  const prevReleaseParamsRef = useRef(releaseParams);

  useEffect(() => {
    if (isEqual(releaseParams, prevReleaseParamsRef.current)) {
      return;
    }
    prevReleaseParamsRef.current = releaseParams;
  }, [releaseParams]);

  const fetchIssuesCount = useCallback(async () => {
    const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;
    const params = [
      `${issuesQuery.new}:"${version}" is:unresolved`,
      `${issuesQuery.all}:"${version}" is:unresolved`,
      `${issuesQuery.unhandled} ${issuesQuery.all}:"${version}" is:unresolved`,
      `${issuesQuery.regressed}:"${version}"`,
    ];
    const queryParameters = {
      ...getReleaseParams({location, releaseBounds}),
      query: params,
    };
    const issueCountEndpoint = `${issuesCountPath}?${qs.stringify(queryParameters)}`;
    const resolvedEndpoint = `/organizations/${
      organization.slug
    }/releases/${encodeURIComponent(version)}/resolved/`;

    try {
      const [issueResponse, resolvedResponse] = await Promise.all([
        api.requestPromise(issueCountEndpoint),
        api.requestPromise(resolvedEndpoint),
      ]);
      setCount({
        all: issueResponse[`${issuesQuery.all}:"${version}" is:unresolved`] || 0,
        new: issueResponse[`${issuesQuery.new}:"${version}" is:unresolved`] || 0,
        resolved: resolvedResponse.length,
        unhandled:
          issueResponse[
            `${issuesQuery.unhandled} ${issuesQuery.all}:"${version}" is:unresolved`
          ] || 0,
        regressed: issueResponse[`${issuesQuery.regressed}:"${version}"`] || 0,
      });
    } catch {
      // do nothing
    }
  }, [api, organization.slug, version, location, releaseBounds]);

  useEffect(() => {
    fetchIssuesCount();
  }, [fetchIssuesCount]);

  function handleIssuesTypeSelection(newIssuesType: IssuesType) {
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          issuesType: newIssuesType,
        },
      },
      {replace: true}
    );
  }

  const handleFetchSuccess = useCallback((groupListState: any, cursorFn: any) => {
    setPageLinks(groupListState.pageLinks);
    setOnCursor(() => cursorFn);
  }, []);

  const renderEmptyMessage = useCallback(() => {
    const isEntireReleasePeriod =
      !location.query.pageStatsPeriod && !location.query.pageStart;

    const {statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
    });

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const selectedTimePeriod = statsPeriod ? DEFAULT_RELATIVE_PERIODS[statsPeriod] : null;
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <EmptyState>
        {issuesType === IssuesType.NEW
          ? isEntireReleasePeriod
            ? t('No new issues in this release.')
            : tct('No new issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
        {issuesType === IssuesType.UNHANDLED
          ? isEntireReleasePeriod
            ? t('No unhandled issues in this release.')
            : tct('No unhandled issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
        {issuesType === IssuesType.REGRESSED
          ? isEntireReleasePeriod
            ? t('No regressed issues in this release.')
            : tct('No regressed issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
        {issuesType === IssuesType.RESOLVED && t('No resolved issues in this release.')}
        {issuesType === IssuesType.ALL
          ? isEntireReleasePeriod
            ? t('No issues in this release')
            : tct('No issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
      </EmptyState>
    );
  }, [issuesType, location, releaseBounds]);

  const issuesTypes = [
    {value: IssuesType.ALL, label: t('All Issues'), issueCount: count.all},
    {value: IssuesType.NEW, label: t('New Issues'), issueCount: count.new},
    {
      value: IssuesType.UNHANDLED,
      label: t('Unhandled'),
      issueCount: count.unhandled,
    },
    {
      value: IssuesType.REGRESSED,
      label: t('Regressed'),
      issueCount: count.regressed,
    },
    {
      value: IssuesType.RESOLVED,
      label: t('Resolved'),
      issueCount: count.resolved,
    },
  ];

  return (
    <Fragment>
      <ControlsWrapper>
        <DemoTourElement
          id={DemoTourStep.RELEASES_ISSUES}
          title={t('New and regressed issues')}
          description={t(
            'Along with reviewing how your release is trending over time compared to previous releases, you can view new and regressed issues here.'
          )}
          position="top-start"
        >
          {tourProps => (
            <div {...tourProps}>
              <SegmentedControl
                aria-label={t('Issue type')}
                size="xs"
                value={issuesType}
                onChange={key => handleIssuesTypeSelection(key)}
              >
                {issuesTypes.map(({value, label, issueCount}) => (
                  <SegmentedControl.Item key={value} textValue={label}>
                    {label}&nbsp;
                    <QueryCount
                      count={issueCount}
                      max={99}
                      hideParens
                      hideIfEmpty={false}
                    />
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl>
            </div>
          )}
        </DemoTourElement>

        <OpenInButtonBar>
          <LinkButton
            to={getIssuesUrl(
              version,
              location,
              releaseBounds,
              issuesType,
              organization.slug
            )}
            size="xs"
          >
            {t('Open in Issues')}
          </LinkButton>

          <StyledPagination pageLinks={pageLinks} onCursor={onCursor} size="xs" />
        </OpenInButtonBar>
      </ControlsWrapper>
      <div data-test-id="release-wrapper">
        <GroupList
          endpoint={endpoint}
          queryParams={queryParams}
          query={`release:"${escapeDoubleQuotes(version)}"`}
          canSelectGroups={false}
          queryFilterDescription={queryFilterDescription}
          withChart={withChart}
          renderEmptyMessage={renderEmptyMessage}
          withPagination={false}
          onFetchSuccess={handleFetchSuccess}
          source="release"
          numPlaceholderRows={queryParams.limit}
        />
      </div>
    </Fragment>
  );
}

const ControlsWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
  }
`;

const OpenInButtonBar = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  margin: ${p => p.theme.space.md} 0;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
