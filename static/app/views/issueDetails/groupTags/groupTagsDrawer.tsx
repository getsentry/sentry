import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {ExportQueryType, useDataExport} from 'sentry/components/dataExport';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  NavigationCrumbs,
  SearchInput,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconDownload, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import useUrlParams from 'sentry/utils/useUrlParams';
import GroupFeatureFlagsDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/groupFeatureFlagsDrawerContent';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import TagDetailsLink from 'sentry/views/issueDetails/groupTags/tagDetailsLink';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

// Used for `tab` state and URL param.
const TAGS_TAB = 'tags';
const FEATURE_FLAGS_TAB = 'featureFlags';
type DrawerTab = 'tags' | 'featureFlags';

function useDrawerTab({enabled}: {enabled: boolean}) {
  const {getParamValue: getTabParam, setParamValue: setTabParam} = useUrlParams('tab');
  const [tab, setTab] = useState<DrawerTab>(
    getTabParam() === FEATURE_FLAGS_TAB ? FEATURE_FLAGS_TAB : TAGS_TAB
  );

  useEffect(() => {
    if (enabled) {
      setTabParam(tab);
    }
  }, [tab, setTabParam, enabled]);

  if (!enabled) {
    return {tab: TAGS_TAB, setTab: (_tab: string) => {}};
  }
  return {tab, setTab};
}

export function GroupTagsDrawer({
  group,
  includeFeatureFlagsTab,
}: {
  group: Group;
  includeFeatureFlagsTab: boolean;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();
  const drawerRef = useRef<HTMLDivElement>(null);
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;
  const [isExportDisabled, setIsExportDisabled] = useState(false);
  const {baseUrl} = useGroupDetailsRoute();
  const handleDataExport = useDataExport({
    payload: {
      queryType: ExportQueryType.ISSUES_BY_TAG,
      queryInfo: {
        project: project.id,
        group: group.id,
        key: tagKey,
      },
    },
  });
  const [search, setSearch] = useState('');
  const {tab, setTab} = useDrawerTab({enabled: includeFeatureFlagsTab});

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId: group.id,
    environment: environments,
  });

  const {data: detailedProject, isPending: isHighlightsPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const highlightTagKeys = useMemo(() => {
    return detailedProject?.highlightTags ?? project?.highlightTags ?? [];
  }, [detailedProject, project]);

  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const displayTags = useMemo(() => {
    const highlightTags = data.filter(tag => highlightTagKeys.includes(tag.key));
    const orderedHighlightTags = highlightTags.sort(
      (a, b) => highlightTagKeys.indexOf(a.key) - highlightTagKeys.indexOf(b.key)
    );
    const remainingTags = data.filter(tag => !highlightTagKeys.includes(tag.key));
    const sortedTags = remainingTags.sort((a, b) => a.key.localeCompare(b.key));
    const orderedTags = [...orderedHighlightTags, ...sortedTags];
    const searchedTags = orderedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.includes(search)
    );
    return searchedTags;
  }, [data, search, tagValues, highlightTagKeys]);

  const headerActions = tagKey ? (
    <DropdownMenu
      size="xs"
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          borderless
          size="xs"
          aria-label={t('Export options')}
          icon={<IconDownload />}
        />
      )}
      items={[
        {
          key: 'export-page',
          label: t('Export Page to CSV'),
          // TODO(issues): Dropdown menu doesn't support hrefs yet
          onAction: () => {
            window.open(
              `/${organization.slug}/${project.slug}/issues/${group.id}/tags/${tagKey}/export/`,
              '_blank'
            );
          },
        },
        {
          key: 'export-all',
          label: isExportDisabled ? t('Export in progress...') : t('Export All to CSV'),
          onAction: () => {
            handleDataExport();
            setIsExportDisabled(true);
          },
          disabled: isExportDisabled,
        },
      ]}
    />
  ) : (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            trackAnalytics('tags.drawer.action', {
              control: 'search',
              organization,
            });
          }}
          aria-label={
            includeFeatureFlagsTab
              ? t('Search All Tags & Feature Flags')
              : t('Search All Tags')
          }
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      {includeFeatureFlagsTab && (
        <SegmentedControl
          size="xs"
          value={tab}
          onChange={newTab => {
            setTab(newTab as DrawerTab);
            setSearch('');
          }}
        >
          <SegmentedControl.Item key={TAGS_TAB}>{t('All Tags')}</SegmentedControl.Item>
          <SegmentedControl.Item key={FEATURE_FLAGS_TAB}>
            {t('All Feature Flags')}
          </SegmentedControl.Item>
        </SegmentedControl>
      )}
    </ButtonBar>
  );

  return (
    <EventDrawerContainer ref={drawerRef}>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            ...(tab === TAGS_TAB
              ? [
                  {
                    label: t('All Tags'),
                    to: tagKey
                      ? {
                          pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
                          query: location.query,
                        }
                      : undefined,
                  },
                  ...(tagKey ? [{label: tagKey}] : []),
                ]
              : tab === FEATURE_FLAGS_TAB
                ? [
                    {
                      label: t('All Feature Flags'),
                    },
                  ]
                : []),
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>
          {tagKey
            ? tct('Tag Details - [tagKey]', {tagKey})
            : includeFeatureFlagsTab
              ? t('Tags & Feature Flags')
              : t('All Tags')}
        </Header>
        {headerActions}
      </EventNavigator>
      <EventDrawerBody>
        {tab === FEATURE_FLAGS_TAB ? (
          <GroupFeatureFlagsDrawerContent
            group={group}
            environments={environments}
            search={search}
          />
        ) : tagKey ? (
          <TagDetailsDrawerContent group={group} />
        ) : isPending || isHighlightsPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError
            message={t('There was an error loading issue tags.')}
            onRetry={refetch}
          />
        ) : displayTags.length === 0 ? (
          <StyledEmptyStateWarning withIcon>
            {data.length === 0
              ? t('No tags were found for this issue')
              : t('No tags were found for this search')}
          </StyledEmptyStateWarning>
        ) : (
          <Wrapper>
            <Container>
              {displayTags.map(tag => (
                <div key={tag.name}>
                  <TagDetailsLink tag={tag} groupId={group.id}>
                    <TagDistribution tag={tag} />
                  </TagDetailsLink>
                </div>
              ))}
            </Container>
          </Wrapper>
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

export const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const Header = styled('h3')`
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

export const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  border: ${p => p.theme.border} solid 1px;
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: ${p => p.theme.fontSizeLarge};
`;
