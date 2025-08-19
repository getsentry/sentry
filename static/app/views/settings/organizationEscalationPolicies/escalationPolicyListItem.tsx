import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {space} from 'sentry/styles/space';
import type {Organization, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';

import type {
  EscalationPolicy,
  EscalationPolicyStepRecipient,
  RotationSchedule,
} from './index';

interface Props {
  organization: Organization;
  policy: EscalationPolicy;
}

function EscalationPolicyListItem({policy, organization}: Props) {
  // Collect all recipients from all steps
  const allRecipients: EscalationPolicyStepRecipient[] = policy.steps.reduce(
    (acc: EscalationPolicyStepRecipient[], step) => [...acc, ...step.recipients],
    []
  );

  const users: User[] = allRecipients
    .filter(r => r.type === 'user')
    .map(r => r.data as User);
  const teams: Team[] = allRecipients
    .filter(r => r.type === 'team')
    .map(r => r.data as Team);
  const schedules: RotationSchedule[] = allRecipients
    .filter(r => r.type === 'schedule')
    .map(r => r.data as RotationSchedule);

  return (
    <PolicyItem>
      <PolicyDetails>
        <PolicyName>
          <Link to={`/settings/${organization.slug}/escalation-policies/${policy.id}/`}>
            {policy.name}
          </Link>
        </PolicyName>
        {policy.description && (
          <PolicyDescription>{policy.description}</PolicyDescription>
        )}
        <PolicyMeta>
          {policy.steps.length} {policy.steps.length === 1 ? 'step' : 'steps'}
          {policy.repeatNTimes > 1 && ` · Repeats ${policy.repeatNTimes} times`}
        </PolicyMeta>
      </PolicyDetails>
      <PolicyRecipients>
        <ParticipantList
          users={users}
          teams={teams}
          schedules={schedules}
          maxVisibleAvatars={5}
        />
      </PolicyRecipients>
    </PolicyItem>
  );
}

const PolicyItem = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} 0;
`;

const PolicyDetails = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const PolicyName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};

  a {
    color: ${p => p.theme.textColor};
    &:hover {
      color: ${p => p.theme.linkHoverColor};
    }
  }
`;

const PolicyDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const PolicyMeta = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const PolicyRecipients = styled('div')`
  display: flex;
  align-items: center;
`;

export default EscalationPolicyListItem;
