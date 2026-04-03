import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {
  useFetchPreferredAgent,
  useFetchPreferredAgentOptions,
} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

type SelectValue = 'off' | 'root_cause' | 'code';
type SelectOptions = {label: string; value: SelectValue};

export function getStoppingPointValue(organization: Organization): SelectValue {
  return organization.defaultAutofixAutomationTuning === 'off'
    ? 'off'
    : organization.defaultAutomatedRunStoppingPoint === 'root_cause'
      ? 'root_cause'
      : 'code';
}

export function useFetchStoppingPointOptions({
  organization,
}: {
  organization: Organization;
}): SelectOptions[] {
  const isSeerAgent = organization.defaultCodingAgent === 'seer';
  const autoOpenPrs = organization.autoOpenPrs;

  const preferredAgent = useFetchPreferredAgent({organization});
  const codingAgentSelectOptions = useFetchPreferredAgentOptions({
    organization,
    enabled: !isSeerAgent,
  });

  if (isSeerAgent) {
    return [
      {value: 'off', label: t('No Automation')},
      {value: 'root_cause', label: t('Automate Root Cause Analysis')},
      {
        value: 'code',
        label: autoOpenPrs
          ? t('Draft a Pull Request with Seer')
          : t('Write Code Changes with Seer'),
      },
    ];
  }

  const preferredAgentLabel = codingAgentSelectOptions.data?.find(
    o => o.value === preferredAgent.data
  )?.label;

  return [
    {value: 'off', label: t('No Automation')},
    {value: 'root_cause', label: t('Automate Root Cause Analysis')},
    {
      value: 'code',
      label: autoOpenPrs
        ? preferredAgentLabel
          ? t('Draft a Pull Request with %s', preferredAgentLabel)
          : t('Draft a Pull Request')
        : preferredAgentLabel
          ? t('Propose Changes with %s', preferredAgentLabel)
          : t('Propose Changes'),
    },
  ];
}

export function getStoppingPointMutationOptions({
  organization,
}: {
  organization: Organization;
}) {
  return mutationOptions({
    mutationFn: ({stoppingPoint}: {stoppingPoint: SelectValue}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          stoppingPoint === 'off'
            ? {defaultAutofixAutomationTuning: 'off'}
            : {
                defaultAutofixAutomationTuning: 'medium',
                defaultAutomatedRunStoppingPoint:
                  stoppingPoint === 'root_cause'
                    ? 'root_cause'
                    : organization.autoOpenPrs
                      ? 'open_pr'
                      : 'code_changes',
              },
      });
    },
    onSuccess: updateOrganization,
  });
}
