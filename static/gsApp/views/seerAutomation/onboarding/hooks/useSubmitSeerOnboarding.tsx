import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface BackendRepository {
  external_id: string;
  integration_id: string;
  name: string;
  organization_id: number;
  owner: string;
  provider: string;
  base_commit_sha?: string;
  branch_name?: string;
  branch_overrides?: Array<{
    branch_name: string;
    tag_name: string;
    tag_value: string;
  }>;
  instructions?: string;
  provider_raw?: string;
}

interface SeerOnboardingPayload {
  fixes: boolean;
  pr_creation: boolean;
  project_repo_mapping: Record<string, BackendRepository[]>;
}

export function useSubmitSeerOnboarding() {
  const organization = useOrganization();

  return useMutation({
    mutationFn: (data: SeerOnboardingPayload) => {
      return fetchMutation<SeerOnboardingPayload>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/seer/onboarding/', {
          path: {
            organizationIdOrSlug: organization.slug,
          },
        }),
        data: {
          autofix: {
            fixes: data.fixes,
            pr_creation: data.pr_creation,
            project_repo_mapping: data.project_repo_mapping,
          },
        },
      });
    },
  });
}
