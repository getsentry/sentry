import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import Count from 'sentry/components/count';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {DeviceName} from 'sentry/components/deviceName';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventReplay/eventDrawer';
import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import useDrawer from 'sentry/components/globalDrawer';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import UserBadge from 'sentry/components/idBadge/userBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedQueryVersions} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {percent} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isUrl} from 'sentry/utils/string/isUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useTagQueries} from 'sentry/views/issueDetails/groupTagValues';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';
import {StyledExternalLink} from 'sentry/views/settings/organizationMembers/inviteBanner';

type GroupTagsDrawerProps = {
  groupId: string;
  project: Project;
};

interface GroupTagsDrawerTagDetailsProps extends GroupTagsDrawerProps {
  drawerRef: React.RefObject<HTMLDivElement>;
}

type TagSort = 'date' | 'count';
const DEFAULT_SORT: TagSort = 'count';

function GroupTagsDrawerTagDetails({groupId, project, drawerRef}: GroupTagsDrawerProps) {
  const location = useLocation();
  const organization = useOrganization();
  const tagKey = location.query.tagDrawerKey as string;
  const environments = useEnvironmentsFromUrl();
  const {cursor, page: _page, ...currentQuery} = location.query;

  const title = tagKey === 'user' ? t('Affected Users') : tagKey;
  const sort: TagSort =
    (location.query.tagDrawerSort as TagSort | undefined) ?? DEFAULT_SORT;
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const {tagValueList, tag, isLoading, isError, pageLinks} = useTagQueries({
    groupId: groupId,
    sort,
    tagKey,
    environments,
    cursor: typeof cursor === 'string' ? cursor : undefined,
  });

  const lastSeenColumnHeader = (
    <StyledSortLink
      to={{
        pathname: location.pathname,
        query: {
          ...currentQuery,
          tagDrawerSort: 'date',
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
          tagDrawerSort: 'count',
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
        // query: `issue:${group.shortId} ${issuesQuery}`,
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
    <Fragment>
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
          environments?.length
            ? t('No tags were found for the currently selected environments')
            : null
        }
      >
        {renderResults()}
      </StyledPanelTable>
      <StyledPagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export function GroupTagsDrawer({project, groupId}: GroupTagsDrawerProps) {
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();
  const tagDrawerKey = location.query.tagDrawerKey as string | undefined;
  const drawerRef = useRef<HTMLDivElement>(null);

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId,
    environment: location.query.environment as string[] | string | undefined,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading issue tags.')}
        onRetry={refetch}
      />
    );
  }

  const alphabeticalTags = data.sort((a, b) => a.key.localeCompare(b.key));

  return (
    <EventDrawerContainer ref={drawerRef}>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{groupId}</ShortId>
                </CrumbContainer>
              ),
            },
            {
              label: t('All Tags'),
              to: tagDrawerKey
                ? {
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      tagDrawerKey: undefined,
                    },
                  }
                : undefined,
            },
            ...(tagDrawerKey ? [{label: tagDrawerKey}] : []),
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{tagDrawerKey ? t('Tag Details') : t('Tags')}</Header>
        {tagDrawerKey && (
          <Fragment>
            <ButtonBar gap={1}>
              <LinkButton
                size="sm"
                priority="default"
                href={`/${organization.slug}/${project.slug}/issues/${groupId}/tags/${tagDrawerKey}/export/`}
              >
                {t('Export Page to CSV')}
              </LinkButton>
              <DataExport
                payload={{
                  queryType: ExportQueryType.ISSUES_BY_TAG,
                  queryInfo: {
                    project: project.id,
                    group: groupId,
                    key: tagDrawerKey,
                  },
                }}
              />
            </ButtonBar>
          </Fragment>
        )}
      </EventNavigator>
      <EventDrawerBody>
        {tagDrawerKey ? (
          <GroupTagsDrawerTagDetails
            project={project}
            groupId={groupId}
            drawerRef={drawerRef}
          />
        ) : (
          <Wrapper>
            <MarginlessAlert type="info">
              {tct(
                'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
                {
                  link: <ExternalLink href={TAGS_DOCS_LINK} />,
                }
              )}
            </MarginlessAlert>
            <Container>
              {alphabeticalTags.map((tag, tagIdx) => (
                <TagItem key={tagIdx}>
                  <StyledPanel>
                    <PanelBody withPadding>
                      <TagHeading>
                        <Button
                          priority="link"
                          size="zero"
                          onClick={() => {
                            navigate(
                              {
                                pathname: location.pathname,
                                query: {
                                  ...location.query,
                                  tagDrawerKey: tag.key,
                                },
                              },
                              {replace: true}
                            );
                          }}
                        >
                          <span data-test-id="tag-title">{tag.key}</span>
                        </Button>
                      </TagHeading>
                      <UnstyledUnorderedList>
                        {tag.topValues.map((tagValue, tagValueIdx) => (
                          <li key={tagValueIdx} data-test-id={tag.key}>
                            <TagProgressBarLink
                              // All events with the tag as the query
                              to={{
                                pathname: `${location.pathname}events/`,
                                query: {
                                  query:
                                    tagValue.query || `${tag.key}:"${tagValue.value}"`,
                                },
                              }}
                            >
                              <TagBarBackground
                                widthPercent={
                                  percent(tagValue.count, tag.totalValues) + '%'
                                }
                              />
                              <TagBarLabel>
                                {tag.key === 'release' ? (
                                  <Version version={tagValue.name} anchor={false} />
                                ) : (
                                  <DeviceName value={tagValue.name} />
                                )}
                              </TagBarLabel>
                              <TagBarCount>
                                <Count value={tagValue.count} />
                              </TagBarCount>
                            </TagProgressBarLink>
                          </li>
                        ))}
                      </UnstyledUnorderedList>
                    </PanelBody>
                  </StyledPanel>
                </TagItem>
              ))}
            </Container>
          </Wrapper>
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

export function useGroupTagsDrawer({
  project,
  groupId,
  openButtonRef,
}: {
  groupId: string;
  openButtonRef: React.RefObject<HTMLButtonElement>;
  project: Project;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(() => <GroupTagsDrawer project={project} groupId={groupId} />, {
      ariaLabel: 'tags drawer',
      onClose: () => {
        if (location.query.tagDrawerSort || location.query.tagDrawerKey) {
          // Remove drawer state from URL
          navigate(
            {
              pathname: location.pathname,
              query: {
                ...location.query,
                tagDrawerSort: undefined,
                tagDrawerKey: undefined,
              },
            },
            {replace: true}
          );
        }
      },
      shouldCloseOnInteractOutside: element => {
        const viewAllButton = openButtonRef.current;
        if (viewAllButton?.contains(element)) {
          return false;
        }
        return true;
      },
    });
  }, [location, navigate, drawer, project, groupId, openButtonRef]);

  return {openTagsDrawer};
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const MarginlessAlert = styled(Alert)`
  margin: 0;
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  height: 100%;
`;

const TagHeading = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
  color: ${p => p.theme.linkColor};
`;

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagItem = styled('div')`
  padding: 0;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
  width: ${p => p.widthPercent};
`;

const TagProgressBarLink = styled(Link)`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.tagBarHover};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;

const StyledPanelTable = styled(PanelTable)`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};

  overflow: auto;

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
