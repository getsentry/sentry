import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {useFetchIssueTag, useFetchIssueTagValues} from 'sentry/actionCreators/group';
import {addMessage} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {DeviceName} from 'sentry/components/deviceName';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedQueryVersions} from 'sentry/types/organization';
import {percent} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isUrl} from 'sentry/utils/string/isUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {
  useEnvironmentsFromUrl,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';

type RouteParams = {
  groupId: string;
  orgId: string;
  tagKey?: string;
};

const DEFAULT_SORT = 'count';

function useTagQueries({
  groupId,
  tagKey,
  environments,
  sort,
  cursor,
}: {
  environments: string[];
  groupId: string;
  sort: string | string[];
  tagKey: string;
  cursor?: string;
}) {
  const organization = useOrganization();

  const {
    data: tagValueList,
    isPending: tagValueListIsLoading,
    isError: tagValueListIsError,
    getResponseHeader,
  } = useFetchIssueTagValues({
    orgSlug: organization.slug,
    groupId,
    tagKey,
    environment: environments,
    sort,
    cursor,
  });
  const {data: tag, isError: tagIsError} = useFetchIssueTag({
    orgSlug: organization.slug,
    groupId,
    tagKey,
  });

  useEffect(() => {
    if (tagIsError) {
      addMessage(t('Failed to fetch total tag values'), 'error');
    }
  }, [tagIsError]);

  return {
    tagValueList,
    tag,
    isLoading: tagValueListIsLoading,
    isError: tagValueListIsError,
    pageLinks: getResponseHeader?.('Link'),
  };
}

export function GroupTagValues() {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<RouteParams>();
  const environments = useEnvironmentsFromUrl();
  const {baseUrl} = useGroupDetailsRoute();
  const {orgId, tagKey = ''} = useParams<RouteParams>();
  const {cursor, page: _page, ...currentQuery} = location.query;

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});
  const project = useProjectFromSlug({organization, projectSlug: group?.project?.slug});

  const title = tagKey === 'user' ? t('Affected Users') : tagKey;
  const sort = location.query.sort || DEFAULT_SORT;
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const {tagValueList, tag, isLoading, isError, pageLinks} = useTagQueries({
    groupId: params.groupId,
    sort,
    tagKey,
    environments,
    cursor: typeof cursor === 'string' ? cursor : undefined,
  });

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return (
      <LoadingError
        message={t('There was an error loading the issue details')}
        onRetry={refetchGroup}
      />
    );
  }

  const lastSeenColumnHeader = (
    <StyledSortLink
      to={{
        pathname: location.pathname,
        query: {
          ...currentQuery,
          sort: 'date',
        },
      }}
    >
      {t('Last Seen')} {sort === 'date' && sortArrow}
    </StyledSortLink>
  );
  const countColumnHeader = (
    <StyledSortLink
      to={{
        pathname: location.pathname,
        query: {
          ...currentQuery,
          sort: 'count',
        },
      }}
    >
      {t('Count')} {sort === 'count' && sortArrow}
    </StyledSortLink>
  );
  const renderResults = () => {
    if (isError) {
      return <StyledLoadingError message={t('There was an error loading tag details')} />;
    }

    if (isLoading) {
      return null;
    }

    const discoverFields = [
      'title',
      'release',
      'environment',
      'user.display',
      'timestamp',
    ];

    const globalSelectionParams = extractSelectionParameters(location.query);
    return tagValueList?.map((tagValue, tagValueIdx) => {
      const pct = tag?.totalValues
        ? `${percent(tagValue.count, tag?.totalValues).toFixed(2)}%`
        : '--';
      const key = tagValue.key ?? tagKey;
      const issuesQuery = tagValue.query || `${key}:"${tagValue.value}"`;
      const discoverView = EventView.fromSavedQuery({
        id: undefined,
        name: key ?? '',
        fields: [
          ...(key !== undefined ? [key] : []),
          ...discoverFields.filter(field => field !== key),
        ],
        orderby: '-timestamp',
        query: `issue:${group.shortId} ${issuesQuery}`,
        projects: [Number(project?.id)],
        environment: environments,
        version: 2 as SavedQueryVersions,
        range: '90d',
      });
      const issuesPath = `/organizations/${orgId}/issues/`;

      return (
        <Fragment key={tagValueIdx}>
          <NameColumn>
            <NameWrapper data-test-id="group-tag-value">
              <GlobalSelectionLink
                to={{
                  pathname: `${baseUrl}events/`,
                  query: {query: issuesQuery},
                }}
              >
                {key === 'user' ? (
                  <UserBadge
                    user={{...tagValue, id: tagValue.id ?? tagValue.value}}
                    avatarSize={20}
                    hideEmail
                  />
                ) : (
                  <DeviceName value={tagValue.name} />
                )}
              </GlobalSelectionLink>
            </NameWrapper>

            {tagValue.email && (
              <StyledExternalLink
                href={`mailto:${tagValue.email}`}
                data-test-id="group-tag-mail"
              >
                <IconMail size="xs" color="gray300" />
              </StyledExternalLink>
            )}
            {isUrl(tagValue.value) && (
              <StyledExternalLink href={tagValue.value} data-test-id="group-tag-url">
                <IconOpen size="xs" color="gray300" />
              </StyledExternalLink>
            )}
          </NameColumn>
          <RightAlignColumn>{pct}</RightAlignColumn>
          <RightAlignColumn>{tagValue.count.toLocaleString()}</RightAlignColumn>
          <RightAlignColumn>
            <TimeSince date={tagValue.lastSeen} />
          </RightAlignColumn>
          <RightAlignColumn>
            <DropdownMenu
              size="sm"
              position="bottom-end"
              triggerProps={{
                size: 'xs',
                showChevron: false,
                icon: <IconEllipsis />,
                'aria-label': t('More'),
              }}
              items={[
                {
                  key: 'open-in-discover',
                  label: t('Open in Discover'),
                  to: discoverView.getResultsViewUrlTarget(
                    orgId,
                    false,
                    hasDatasetSelector(organization)
                      ? SavedQueryDatasets.ERRORS
                      : undefined
                  ),
                  hidden: !organization.features.includes('discover-basic'),
                },
                {
                  key: 'search-issues',
                  label: t('Search All Issues with Tag Value'),
                  to: {
                    pathname: issuesPath,
                    query: {
                      ...globalSelectionParams, // preserve page filter selections
                      query: issuesQuery,
                    },
                  },
                },
              ]}
            />
          </RightAlignColumn>
        </Fragment>
      );
    });
  };

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <TitleWrapper>
          <Title>{t('Tag Details')}</Title>
          <ButtonBar gap={1}>
            <LinkButton
              size="sm"
              priority="default"
              href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${tagKey}/export/`}
            >
              {t('Export Page to CSV')}
            </LinkButton>
            <DataExport
              payload={{
                queryType: ExportQueryType.ISSUES_BY_TAG,
                queryInfo: {
                  project: group.project.id,
                  group: group.id,
                  key: tagKey,
                },
              }}
            />
          </ButtonBar>
        </TitleWrapper>
        <StyledPanelTable
          isLoading={isLoading}
          isEmpty={!isError && tagValueList?.length === 0}
          headers={[
            title,
            <PercentColumnHeader key="percent">{t('Percent')}</PercentColumnHeader>,
            countColumnHeader,
            lastSeenColumnHeader,
            '',
          ]}
          emptyMessage={t('Sorry, the tags for this issue could not be found.')}
          emptyAction={
            environments.length
              ? t('No tags were found for the currently selected environments')
              : null
          }
        >
          {renderResults()}
        </StyledPanelTable>
        <StyledPagination pageLinks={pageLinks} />
      </Layout.Main>
    </Layout.Body>
  );
}

function GroupTagValuesRoute() {
  const hasStreamlinedUI = useHasStreamlinedUI();

  // TODO(streamlined-ui): Point the router directly to group event details
  if (hasStreamlinedUI) {
    return <GroupEventDetails />;
  }

  return <GroupTagValues />;
}

const TitleWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const Title = styled('h3')`
  margin: 0;
`;

const StyledPanelTable = styled(PanelTable)`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};

  overflow: auto;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  & > * {
    padding: ${space(1)} ${space(2)};
  }
`;

const StyledLoadingError = styled(LoadingError)`
  grid-column: 1 / -1;
  margin-bottom: ${space(4)};
  border-radius: 0;
  border-width: 1px 0;
`;

const PercentColumnHeader = styled('div')`
  text-align: right;
`;

const StyledSortLink = styled(Link)`
  text-align: right;
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const StyledExternalLink = styled(ExternalLink)`
  margin-left: ${space(0.5)};
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
`;

const NameColumn = styled(Column)`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  min-width: 320px;
`;

const NameWrapper = styled('span')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const RightAlignColumn = styled(Column)`
  justify-content: flex-end;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

export default GroupTagValuesRoute;
