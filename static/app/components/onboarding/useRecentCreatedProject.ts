import moment from 'moment-timezone';

import type {OnboardingRecentCreatedProject} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';

// Refetch the data every second
const DEFAULT_POLL_INTERVAL_MS = 1000;

type Props = {
  orgSlug: Organization['slug'];
  pollUntilFirstEvent?: boolean;
  projectSlug?: Project['slug'];
};

function isProjectActive(project: Project) {
  const olderThanOneHour = project
    ? moment.duration(moment().diff(project.dateCreated)).asHours() > 1
    : false;
  return !!(
    project?.firstTransactionEvent ||
    project?.hasReplays ||
    project?.hasSessions ||
    project?.firstEvent ||
    olderThanOneHour
  );
}

// This hook will fetch the project details endpoint until a firstEvent (issue) is received
// It uses useProjects() to leverage already loaded data while also fetching for updates
export function useRecentCreatedProject({
  orgSlug,
  projectSlug,
  pollUntilFirstEvent,
}: Props): OnboardingRecentCreatedProject {
  const {projects, initiallyLoaded} = useProjects({
    slugs: projectSlug ? [projectSlug] : undefined,
    orgId: orgSlug,
  });

  const project =
    projectSlug && initiallyLoaded
      ? projects.find(p => p.slug === projectSlug)
      : undefined;

  const {isPending: isProjectLoading, data: freshProject} = useApiQuery<Project>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/overview/', {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug!,
        },
      }),
    ],
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

  if (isProjectLoading || !freshProject) {
    return {
      isProjectActive: project ? isProjectActive(project) : false,
      project,
    };
  }

  return {
    isProjectActive: isProjectActive(freshProject),
    project: freshProject,
  };
}
