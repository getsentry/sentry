import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {ExportQueryType, useDataExport} from 'sentry/components/dataExport';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconDownload, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import useUrlParams from 'sentry/utils/useUrlParams';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/flagDetailsDrawerContent';
import GroupFeatureFlagsDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/groupFeatureFlagsDrawerContent';
import GroupTagsDrawerContent from 'sentry/views/issueDetails/groupTags/groupTagsDrawerContent';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

// Used for `tab` state and URL param.
export enum DrawerTab {
  TAGS = 'tags',
  FEATURE_FLAGS = 'featureFlags',
}

function useDrawerTab({enabled}: {enabled: boolean}) {
  const {getParamValue: getTabParam, setParamValue: setTabParam} = useUrlParams('tab');
  const [tab, setTab] = useState<DrawerTab>(
    getTabParam() === DrawerTab.FEATURE_FLAGS ? DrawerTab.FEATURE_FLAGS : DrawerTab.TAGS
  );

  useEffect(() => {
    if (enabled) {
      setTabParam(tab);
    }
  }, [tab, setTabParam, enabled]);

  if (!enabled) {
    return {tab: DrawerTab.TAGS, setTab: (_tab: string) => {}};
  }
  return {tab, setTab};
}

function getHeaderTitle(
  tagKey: string | undefined,
  tab: DrawerTab,
  includeFeatureFlagsTab: boolean
) {
  if (tagKey) {
    return tab === DrawerTab.TAGS
      ? tct('Tag Details - [tagKey]', {tagKey})
      : tct('Feature Flag Details - [tagKey]', {tagKey});
  }

  return includeFeatureFlagsTab ? t('Tags & Feature Flags') : t('All Tags');
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
  // XXX: tagKey param is re-used for feature flag details drawer
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
          <SegmentedControl.Item key={DrawerTab.TAGS}>
            {t('All Tags')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key={DrawerTab.FEATURE_FLAGS}>
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
            tab === DrawerTab.TAGS
              ? {
                  label: t('All Tags'),
                  to: tagKey
                    ? {
                        pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
                        query: {...location.query, tab: DrawerTab.TAGS},
                      }
                    : undefined,
                }
              : {
                  label: t('All Feature Flags'),
                  to: tagKey
                    ? {
                        pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
                        query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
                      }
                    : undefined,
                },
            ...(tagKey ? [{label: tagKey}] : []),
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>
          {getHeaderTitle(tagKey, tab as DrawerTab, includeFeatureFlagsTab)}
        </Header>
        {headerActions}
      </EventNavigator>
      <EventDrawerBody>
        {tagKey && tab === DrawerTab.TAGS ? (
          <TagDetailsDrawerContent group={group} />
        ) : tagKey && tab === DrawerTab.FEATURE_FLAGS ? (
          <FlagDetailsDrawerContent />
        ) : tab === DrawerTab.FEATURE_FLAGS ? (
          <GroupFeatureFlagsDrawerContent
            group={group}
            environments={environments}
            search={search}
          />
        ) : (
          <GroupTagsDrawerContent
            group={group}
            environments={environments}
            organization={organization}
            project={project}
            search={search}
          />
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const Header = styled('h3')`
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;
