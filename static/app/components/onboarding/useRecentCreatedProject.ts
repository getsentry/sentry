import type {OnboardingRecentCreatedProject} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isProjectActive} from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';

// Refetch the data every second
const DEFAULT_POLL_INTERVAL_MS = 1000;

type Props = {
  orgSlug: Organization['slug'];
  pollUntilFirstEvent?: boolean;
  projectSlug?: Project['slug'];
};

// This hook will fetch the project details endpoint until a firstEvent (issue) is received
export function useRecentCreatedProject({
  orgSlug,
  projectSlug,
  pollUntilFirstEvent,
}: Props): OnboardingRecentCreatedProject {
  const {isPending: isProjectLoading, data: project} = useApiQuery<Project>(
    [`/projects/${orgSlug}/${projectSlug}/overview/`],
    {
      staleTime: 0,
      enabled: !!projectSlug,
      refetchInterval: query => {
        if (!query.state.data) {
          return false;
        }
        const [projectData] = query.state.data;

        if (pollUntilFirstEvent) {
          return projectData.firstEvent ? false : DEFAULT_POLL_INTERVAL_MS;
        }
        return isProjectActive(projectData) ? false : DEFAULT_POLL_INTERVAL_MS;
      },
    }
  );

  if (isProjectLoading || !project) {
    return {
      isProjectActive: false,
      project: undefined,
    };
  }

  const isActive = isProjectActive(project);

  return {
    project,
    isProjectActive: isActive,
  };
}
