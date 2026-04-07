import {updateOrganization} from 'sentry/actionCreators/organizations';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {useFetchAgentOptions} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

type SelectValue = 'off' | 'root_cause' | 'code';
type SelectOptions = {label: string; value: SelectValue};

export function getDefaultStoppingPointValue(organization: Organization): SelectValue {
  if ([null, undefined, 'off'].includes(organization.defaultAutofixAutomationTuning)) {
    return 'off';
  }
  return organization.defaultAutomatedRunStoppingPoint === 'root_cause'
    ? 'root_cause'
    : 'code';
}

export function useFetchStoppingPointOptions({
  organization,
  agent,
}: {
  agent: undefined | 'seer' | CodingAgentIntegration;
  organization: Organization;
}): SelectOptions[] {
  const autoOpenPrs = organization.autoOpenPrs;

  const isSeerAgent = agent === 'seer';
  const codingAgentSelectOptions = useFetchAgentOptions({
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

  const agentLabel = codingAgentSelectOptions.data?.find(
    o => o.value === agent || (typeof o.value === 'object' && o.value.id === agent?.id)
  )?.label;

  return [
    {value: 'off', label: t('No Automation')},
    {value: 'root_cause', label: t('Automate Root Cause Analysis')},
    {
      value: 'code',
      label: autoOpenPrs
        ? agentLabel
          ? t('Draft a Pull Request with %s', agentLabel)
          : t('Draft a Pull Request')
        : agentLabel
          ? t('Propose Changes with %s', agentLabel)
          : t('Propose Changes'),
    },
  ];
}

export function getDefaultStoppingPointMutationOptions({
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
