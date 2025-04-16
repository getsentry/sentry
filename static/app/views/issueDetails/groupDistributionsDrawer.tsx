import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
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
import {IconDownload, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import TagFlagPicker from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import useDrawerTab from 'sentry/views/issueDetails/groupDistributions/useDrawerTab';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/flagDetailsDrawerContent';
import FlagDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import TagDrawerContent from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

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

/**
 * Shared tags and feature flags distributions drawer, used by streamlined issue details UI.
 */
export function GroupDistributionsDrawer(props: GroupDistributionsDrawerProps) {
  return (
    <AnalyticsArea name="distributions_drawer">
      <BaseGroupDistributionsDrawer {...props} />
    </AnalyticsArea>
  );
}

type GroupDistributionsDrawerProps = {
  group: Group;
  includeFeatureFlagsTab: boolean;
};

function BaseGroupDistributionsDrawer({
  group,
  includeFeatureFlagsTab,
}: GroupDistributionsDrawerProps) {
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

  const headerActions =
    tagKey && tab === DrawerTab.TAGS ? (
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
    ) : tagKey && tab === DrawerTab.FEATURE_FLAGS ? null : (
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
          <TagFlagPicker
            tab={tab}
            setTab={newTab => {
              setTab(newTab);
              setSearch('');
            }}
          />
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
                        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
                        query: {...location.query, tab: DrawerTab.TAGS},
                      }
                    : undefined,
                }
              : {
                  label: t('All Feature Flags'),
                  to: tagKey
                    ? {
                        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}`,
                        query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
                      }
                    : undefined,
                },
            ...(tagKey ? [{label: tagKey}] : []),
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{getHeaderTitle(tagKey, tab, includeFeatureFlagsTab)}</Header>
        {headerActions}
      </EventNavigator>
      <EventDrawerBody>
        {tagKey && tab === DrawerTab.TAGS ? (
          <TagDetailsDrawerContent group={group} />
        ) : tagKey && tab === DrawerTab.FEATURE_FLAGS ? (
          <AnalyticsArea name="feature_flag_details">
            <FlagDetailsDrawerContent />
          </AnalyticsArea>
        ) : tab === DrawerTab.FEATURE_FLAGS ? (
          <AnalyticsArea name="feature_flag_distributions">
            <FlagDrawerContent
              group={group}
              environments={environments}
              search={search}
            />
          </AnalyticsArea>
        ) : (
          <TagDrawerContent
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
