import {useMemo} from 'react';

import {replayBackendPlatforms} from 'sentry/data/platformCategories';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {projectCanUpsellReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import useProjects from 'sentry/utils/useProjects';

interface Props {
  event: Event;
  projectSlug: string;
  group?: Group;
}

type Result =
  | {
      canShowUpsell: false;
      upsellPlatform: undefined;
      upsellProjectId: undefined;
    }
  | {
      canShowUpsell: boolean;
      upsellPlatform: PlatformKey;
      upsellProjectId: string;
    };

export default function useEventCanShowReplayUpsell({
  event,
  group,
  projectSlug,
}: Props): Result {
  const organization = useOrganization();
  const hasReplaysFeature = organization.features.includes('session-replay');

  const {projects, fetching: fetchingHasSentReplays} = useProjects();
  const hasOrgSentReplays = useMemo(() => projects.some(p => p.hasReplays), [projects]);
  const project = useProjectFromSlug({organization, projectSlug});

  if (!hasReplaysFeature || fetchingHasSentReplays) {
    return {
      canShowUpsell: false,
      upsellPlatform: undefined,
      upsellProjectId: undefined,
    };
  }

  const upsellPlatform = group?.project.platform ?? group?.platform ?? 'other';
  const upsellProjectId = group?.project.id ?? event.projectID ?? '';

  // Check if this group has replays compatibility. If we don't have a group, show the upsell.
  const groupHasReplays = group
    ? getConfigForIssueType(group, group?.project).pages.replays.enabled
    : true;

  const canShowUpsell =
    groupHasReplays &&
    projectCanUpsellReplay(project) &&
    (!hasOrgSentReplays || replayBackendPlatforms.includes(upsellPlatform));

  return {
    canShowUpsell,
    upsellPlatform,
    upsellProjectId,
  };
}
