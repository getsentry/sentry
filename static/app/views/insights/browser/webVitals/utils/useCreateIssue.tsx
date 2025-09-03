import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

type CreateIssueData = Record<string, any>;

interface CreateIssueResponse {
  event_id: string;
}

export function useCreateIssue() {
  const organization = useOrganization();
  const {
    selection: {projects},
  } = usePageFilters();
  const {projects: allProjects} = useProjects();

  const orgSlug = organization.slug;
  const projectId = projects[0];
  const projectSlug =
    projectId === undefined
      ? null
      : allProjects.find(project => project.id === `${projectId}`)?.slug;
  return useMutation<CreateIssueResponse, RequestError, CreateIssueData>({
    mutationFn: (data: CreateIssueData) =>
      fetchMutation({
        url: `/projects/${orgSlug}/${projectSlug}/user-issue/`,
        method: 'POST',
        data,
      }),
  });
}
