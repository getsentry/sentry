import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import EscalationPolicyListItem from './escalationPolicyListItem';

// Types for escalation policies
export interface RotationSchedule {
  id: string;
  name: string;
  description?: string;
}

export interface EscalationPolicyStepRecipient {
  data: User | Team | RotationSchedule;
  type: 'user' | 'team' | 'schedule';
}

export interface EscalationPolicyStep {
  escalateAfterSec: number;
  recipients: EscalationPolicyStepRecipient[];
  stepNumber: number;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  repeatNTimes: number;
  steps: EscalationPolicyStep[];
  description?: string;
}

function OrganizationEscalationPolicies() {
  const organization = useOrganization();

  const {
    data: escalationPolicies,
    isPending,
    isError,
    refetch,
  } = useApiQuery<EscalationPolicy[]>(
    [`/organizations/${organization.slug}/escalation-policies/`],
    {
      staleTime: 0,
    }
  );

  const action = (
    <Button
      priority="primary"
      size="sm"
      icon={<IconAdd />}
      to={`/settings/${organization.slug}/escalation-policies/new/`}
    >
      {t('Add Policy')}
    </Button>
  );

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Escalation Policies'), organization.slug, false)}
      />
      <SettingsPageHeader title={t('Escalation Policies')} action={action} />

      <Panel>
        <PanelHeader>{t('Policies')}</PanelHeader>
        <PanelBody>
          {isPending && <LoadingIndicator />}
          {isError && <LoadingError onRetry={refetch} />}
          {escalationPolicies &&
            escalationPolicies.length > 0 &&
            escalationPolicies.map(policy => (
              <StyledPanelItem key={policy.id}>
                <EscalationPolicyListItem policy={policy} organization={organization} />
              </StyledPanelItem>
            ))}
          {escalationPolicies && escalationPolicies.length === 0 && (
            <EmptyMessage>
              {t('No escalation policies have been created yet.')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default OrganizationEscalationPolicies;

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(2)};
`;
