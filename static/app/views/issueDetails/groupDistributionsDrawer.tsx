import {DrawerHeader} from '@sentry/scraps/drawer';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {EventDrawerContainer} from 'sentry/components/events/eventDrawer';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {FlagsDistributionDrawer} from './groupDistributions/flagsDistributionDrawer';
import {GroupDistributionCrumbs} from './groupDistributions/groupDistributionCrumbs';
import {TagsDistributionDrawer} from './groupDistributions/tagsDistributionDrawer';
import {DrawerTab} from './groupDistributions/types';
import {useDrawerTab} from './groupDistributions/useDrawerTab';

type Props = {
  group: Group;
  includeFeatureFlagsTab: boolean;
};

/**
 * Shared tags and feature flags distributions drawer used by issue details.
 */
export function GroupDistributionsDrawer({group, includeFeatureFlagsTab}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const {tab, setTab} = useDrawerTab({enabled: includeFeatureFlagsTab});

  return (
    <AnalyticsArea name="distributions_drawer">
      <EventDrawerContainer>
        <DrawerHeader>
          <GroupDistributionCrumbs group={group} project={project} tab={tab} />
        </DrawerHeader>
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
