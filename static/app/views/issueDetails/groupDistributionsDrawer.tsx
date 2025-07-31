import AnalyticsArea from 'sentry/components/analyticsArea';
import {
  EventDrawerContainer,
  EventDrawerHeader,
} from 'sentry/components/events/eventDrawer';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import FlagsDistributionDrawer from 'sentry/views/issueDetails/groupDistributions/flagsDistributionDrawer';
import GroupDistributionCrumbs from 'sentry/views/issueDetails/groupDistributions/groupDistributionCrumbs';
import TagsDistributionDrawer from 'sentry/views/issueDetails/groupDistributions/tagsDistributionDrawer';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import useDrawerTab from 'sentry/views/issueDetails/groupDistributions/useDrawerTab';

type Props = {
  group: Group;
  includeFeatureFlagsTab: boolean;
};

/**
 * Shared tags and feature flags distributions drawer, used by streamlined issue details UI.
 */
export function GroupDistributionsDrawer({group, includeFeatureFlagsTab}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const {tab, setTab} = useDrawerTab({enabled: includeFeatureFlagsTab});

  return (
    <AnalyticsArea name="distributions_drawer">
      <EventDrawerContainer>
        <EventDrawerHeader>
          <GroupDistributionCrumbs project={project} group={group} tab={tab} />
        </EventDrawerHeader>
        {tab === DrawerTab.TAGS ? (
          <TagsDistributionDrawer
            organization={organization}
            group={group}
            project={project}
            setTab={setTab}
            includeFeatureFlagsTab={includeFeatureFlagsTab}
          />
        ) : (
          <FlagsDistributionDrawer
            organization={organization}
            group={group}
            setTab={setTab}
          />
        )}
      </EventDrawerContainer>
    </AnalyticsArea>
  );
}
