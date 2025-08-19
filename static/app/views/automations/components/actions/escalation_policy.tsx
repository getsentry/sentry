import styled from '@emotion/styled';

import PolicySelector from 'sentry/components/policySelector';
import {selectControlStyles} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {Action} from 'sentry/types/workflowEngine/actions';
import useOrganization from 'sentry/utils/useOrganization';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {useFetchEscalationPolicies} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';

export function EscalationPolicyDetails({action}: {action: Action}) {
  const {targetIdentifier} = action.config;

  if (targetIdentifier) {
    return (
      <AssignedToEscalationPolicy escalationPolicyId={parseInt(targetIdentifier, 10)} />
    );
  }
  return t('Trigger escalation policy');
}

function AssignedToEscalationPolicy({escalationPolicyId}: {escalationPolicyId: number}) {
  const organization = useOrganization();
  const {data: escalationPolicies} = useFetchEscalationPolicies({
    orgSlug: organization.slug,
  });
  const escalationPolicy = escalationPolicies?.find(p => p.id === escalationPolicyId);
  return t('Trigger escalation policy %s', `${escalationPolicy?.name ?? 'unknown'}`);
}

export function EscalationPolicyNode() {
  return tct('Trigger escalation policy [identifier]', {
    identifier: <IdentifierField />,
  });
}

function IdentifierField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();
  const organization = useOrganization();

  return (
    <SelectWrapper>
      <PolicySelector
        organization={organization}
        aria-label={t('Escalation Policy')}
        name={`${actionId}.config.targetIdentifier`}
        value={action.config.targetIdentifier}
        onChange={(value: any) => {
          value.value = parseInt(value.value, 10);
          onUpdate({
            config: {targetIdentifier: value},
            data: {},
          });
          removeError(action.id);
        }}
        useId
        styles={selectControlStyles}
      />
    </SelectWrapper>
  );
}

export function validateEscalationPolicyAction(action: Action): string | undefined {
  if (!action.config.targetIdentifier) {
    return t('You must specify an escalation policy.');
  }
  return undefined;
}

const SelectWrapper = styled('div')`
  width: 200px;
`;
