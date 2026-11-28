import {IconAdd} from '@sentry/icons/add';
import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {IssueSidebarButton} from 'sentry/components/group/issueSidebarButton';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useAssessImpact(group: Group) {
  const organization = useOrganization();
  return useMutation({
    mutationFn: () =>
      fetchMutation<{runId: string}>({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/issues/$issueId/impact/assess/',
          {path: {organizationIdOrSlug: organization.slug, issueId: group.id}}
        ),
      }),
    onMutate: () => {
      toast.loading(t('Starting impact assessment\u2026'));
    },
    onError: () => {
      toast.error(t('Unable to start impact assessment'));
    },
  });
}

export function AssessImpactButton({group}: {group: Group}) {
  const {mutate: assessImpact, isPending} = useAssessImpact(group);

  return (
    <IssueSidebarButton
      busy={isPending}
      icon={<IconAdd />}
      onClick={() => assessImpact()}
      size="zero"
      variant="transparent"
    >
      {t('Assess impact')}
    </IssueSidebarButton>
  );
}
