import moment from 'moment';

import {Group, OnboardingRecentCreatedProject, Organization, Project} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

// Refetch the data every second
const DEFAULT_POLL_INTERVAL_MS = 1000;

type Props = {
  orgSlug: Organization['slug'];
  projectSlug?: Project['slug'];
};

// This hook will fetch the project details endpoint until a firstEvent(issue) is received
// When the firstEvent is received it fetches the issues endpoint to find the first issue
export function useRecentCreatedProject({
  orgSlug,
  projectSlug,
}: Props): undefined | OnboardingRecentCreatedProject {
  const {isLoading: isProjectLoading, data: project} = useApiQuery<Project>(
    [`/projects/${orgSlug}/${projectSlug}/`],
    {
      staleTime: 0,
      enabled: !!projectSlug,
      refetchInterval: data => {
        if (!data) {
          return false;
        }
        const [projectData] = data;
        return projectData?.firstEvent ? false : DEFAULT_POLL_INTERVAL_MS;
      },
    }
  );

  const firstEvent = project?.firstEvent;

  const {data: issues} = useApiQuery<Group[]>(
    [`/projects/${orgSlug}/${projectSlug}/issues/`],
    {
      staleTime: Infinity,
      enabled: !!firstEvent,
    }
  );

  const firstIssue =
    !!firstEvent && issues
      ? issues.find((issue: Group) => issue.firstSeen === firstEvent)
      : undefined;

  const olderThanOneHour = project
    ? moment.duration(moment().diff(project.dateCreated)).asHours() > 1
    : false;

  if (isProjectLoading || !project) {
    return undefined;
  }

  return {
    ...project,
    firstTransaction: !!project?.firstTransactionEvent,
    hasReplays: !!project?.hasReplays,
    hasSessions: !!project?.hasSessions,
    firstError: !!firstEvent,
    firstIssue,
    olderThanOneHour,
  };
}
