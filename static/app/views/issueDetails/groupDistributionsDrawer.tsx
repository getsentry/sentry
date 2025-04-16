import {useRef, useState} from 'react';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
} from 'sentry/components/events/eventDrawer';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import GroupDistributionCrumbs from 'sentry/views/issueDetails/groupDistributions/groupDistributionCrumbs';
import HeaderTitle from 'sentry/views/issueDetails/groupDistributions/headerTitle';
import ListSearchInput from 'sentry/views/issueDetails/groupDistributions/listSearchInput';
import TagExportDropdown from 'sentry/views/issueDetails/groupDistributions/tagExportDropdown';
import TagFlagPicker from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import useDrawerTab from 'sentry/views/issueDetails/groupDistributions/useDrawerTab';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/flagDetailsDrawerContent';
import FlagDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import TagDrawerContent from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

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
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  // XXX: tagKey param is re-used for feature flag details drawer
  const {tagKey} = useParams<{tagKey: string}>();
  const drawerRef = useRef<HTMLDivElement>(null);
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const [search, setSearch] = useState('');
  const {tab, setTab} = useDrawerTab({enabled: includeFeatureFlagsTab});

  const headerActions =
    tagKey && tab === DrawerTab.TAGS ? (
      <TagExportDropdown
        tagKey={tagKey}
        group={group}
        organization={organization}
        project={project}
      />
    ) : tagKey && tab === DrawerTab.FEATURE_FLAGS ? null : (
      <ButtonBar gap={1}>
        <ListSearchInput
          includeFeatureFlagsTab={includeFeatureFlagsTab}
          search={search}
          onChange={value => {
            setSearch(value);
            trackAnalytics('tags.drawer.action', {
              control: 'search',
              organization,
            });
          }}
        />
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
        <GroupDistributionCrumbs group={group} project={project} tab={tab} />
      </EventDrawerHeader>
      <EventNavigator>
        <HeaderTitle
          includeFeatureFlagsTab={includeFeatureFlagsTab}
          tab={tab}
          tagKey={tagKey}
        />
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
