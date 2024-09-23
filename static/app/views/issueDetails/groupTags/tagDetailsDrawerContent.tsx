import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useFetchIssueTag, useFetchIssueTagValues} from 'sentry/actionCreators/group';
import {DeviceName} from 'sentry/components/deviceName';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {SavedQueryVersions} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {percent} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isUrl} from 'sentry/utils/string/isUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';
import {StyledExternalLink} from 'sentry/views/settings/organizationMembers/inviteBanner';

type GroupTagsDrawerProps = {
  groupId: Group['id'];
  project: Project;
};

interface GroupTagsDrawerTagDetailsProps extends GroupTagsDrawerProps {
  /**
   * Helps dropdowns append to the correct element
   */
  drawerRef: React.RefObject<HTMLDivElement>;
}

const discoverFields = ['title', 'release', 'environment', 'user.display', 'timestamp'];

type TagSort = 'date' | 'count';
const DEFAULT_SORT: TagSort = 'count';

export function TagDetailsDrawerContent({
  groupId,
  project,
  drawerRef,
}: GroupTagsDrawerTagDetailsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const tagKey = location.query.tagDrawerKey as string;
  const environments = useEnvironmentsFromUrl();

  const title = tagKey === 'user' ? t('Affected Users') : tagKey;
  const sort: TagSort =
    (location.query.tagDrawerSort as TagSort | undefined) ?? DEFAULT_SORT;
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

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
    cursor: location.query.cursor as string | undefined,
  });
  const {
    data: tag,
    isError: tagIsError,
    isLoading: tagIsLoading,
  } = useFetchIssueTag({
    orgSlug: organization.slug,
    groupId,
    tagKey,
  });
  const {data: group} = useGroup({groupId});

  const isLoading = tagValueListIsLoading || tagIsLoading;
  const isError = tagIsError || tagValueListIsError;

  if (isError) {
    return <LoadingError message={t('There was an error loading tag details')} />;
  }

  const globalSelectionParams = extractSelectionParameters(location.query);
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

  return (
    <Fragment>
      <StyledPanelTable
        isLoading={isLoading}
        isEmpty={!isError && tagValueList?.length === 0}
        headers={[
          title,
          <PercentColumnHeader key="percent">{t('Percent')}</PercentColumnHeader>,
          <StyledSortLink
            key="count"
            to={{
              pathname: location.pathname,
              query: {
                ...currentQuery,
                cursor: undefined,
                tagDrawerSort: 'count',
              },
            }}
          >
            {t('Count')} {sort === 'count' && sortArrow}
          </StyledSortLink>,
          <StyledSortLink
            key="date"
            to={{
              pathname: location.pathname,
              query: {
                ...currentQuery,
                cursor: undefined,
                tagDrawerSort: 'date',
              },
            }}
          >
            {t('Last Seen')} {sort === 'date' && sortArrow}
          </StyledSortLink>,
          '',
        ]}
        emptyMessage={t('Sorry, the tags for this issue could not be found.')}
        emptyAction={
          environments?.length
            ? t('No tags were found for the currently selected environments')
            : null
        }
      >
        {tagValueList?.map((tagValue, tagValueIdx) => {
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
            query: group ? `issue:${group.shortId} ${issuesQuery}` : undefined,
            projects: [Number(project?.id)],
            environment: environments,
            version: 2 as SavedQueryVersions,
            range: '90d',
          });
          const issuesPath = `/organizations/${organization.slug}/issues/`;
          return (
            <Fragment key={tagValueIdx}>
              <NameColumn>
                <NameWrapper data-test-id="group-tag-value">
                  <GlobalSelectionLink
                    to={{
                      pathname: `${location.pathname}events/`,
                      query: {query: issuesQuery},
                    }}
                  >
                    {key === 'user' ? (
                      <UserBadge
                        user={{...tagValue, id: tagValue.id ?? ''}}
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
                  usePortal
                  portalContainerRef={drawerRef}
                  items={[
                    {
                      key: 'open-in-discover',
                      label: t('Open in Discover'),
                      to: discoverView.getResultsViewUrlTarget(
                        organization.slug,
                        false,
                        hasDatasetSelector(organization)
                          ? SavedQueryDatasets.ERRORS
                          : undefined
                      ),
                      hidden: !group || !organization.features.includes('discover-basic'),
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
        })}
      </StyledPanelTable>
      <StyledPagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};

  overflow: auto;

  & > * {
    padding: ${space(1)} ${space(2)};
  }
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
