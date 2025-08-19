import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Timeline} from 'sentry/components/timeline';
import {
  IconClock,
  IconDelete,
  IconEdit,
  IconExclamation,
  IconMegaphone,
  IconRefresh,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import type {
  EscalationPolicy,
  EscalationPolicyStepRecipient,
  RotationSchedule,
} from './index';

function NotifyItem({recipients}: {recipients: EscalationPolicyStepRecipient[]}) {
  const users: User[] =
    recipients.filter(r => r.type === 'user').map(r => r.data as User) || [];
  const teams: Team[] =
    recipients.filter(r => r.type === 'team').map(r => r.data as Team) || [];
  const schedules: RotationSchedule[] =
    recipients.filter(r => r.type === 'schedule').map(r => r.data as RotationSchedule) ||
    [];

  return (
    <Timeline.Item
      title={t('Notify:')}
      icon={<IconMegaphone size="xs" />}
      colorConfig={{
        title: 'purple400',
        icon: 'purple400',
        iconBorder: 'purple200',
      }}
    >
      <ParticipantList
        users={users}
        teams={teams}
        schedules={schedules}
        maxVisibleAvatars={10}
      />
    </Timeline.Item>
  );
}

function IncidentCreatedItem() {
  return (
    <IncidentCreatedTimelineItem
      title={t('Immediately after an incident is created...')}
      icon={<IconExclamation size="xs" />}
      colorConfig={{
        title: 'red400',
        icon: 'red400',
        iconBorder: 'red200',
      }}
      isActive
    />
  );
}

function EscalateAfterItem({minutes}: {minutes: number}) {
  return (
    <EscalateAfterTimelineItem
      title={
        <Fragment>
          {t('Escalate after ')}
          <u>
            {minutes} {t('minutes')}
          </u>
          {t(' if not acknowledged')}
        </Fragment>
      }
      icon={<IconClock size="xs" />}
      colorConfig={{
        title: 'blue400',
        icon: 'blue400',
        iconBorder: 'blue200',
      }}
    />
  );
}

function RepeatItem({n}: {n: number}) {
  return (
    <Timeline.Item
      title={t('Repeat: %s time%s', n, n > 1 ? 's' : '')}
      icon={<IconRefresh size="xs" />}
      colorConfig={{
        title: 'yellow400',
        icon: 'yellow400',
        iconBorder: 'yellow200',
      }}
      isActive
    />
  );
}

function EscalationPolicyDetails() {
  const api = useApi();
  const organization = useOrganization();
  const params = useParams<{escalationPolicyId: string}>();
  const escalationPolicyId = params.escalationPolicyId;

  const {
    data: policy,
    isPending,
    isError,
    refetch,
  } = useApiQuery<EscalationPolicy>(
    [`/organizations/${organization.slug}/escalation-policies/${escalationPolicyId}/`],
    {
      staleTime: 0,
    }
  );

  const {mutate: deletePolicy, isPending: isDeleting} = useMutation({
    mutationFn: () =>
      api.requestPromise(
        `/organizations/${organization.slug}/escalation-policies/${escalationPolicyId}/`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: () => {
      addSuccessMessage(t('Escalation policy deleted successfully'));
      browserHistory.push(`/settings/${organization.slug}/escalation-policies/`);
    },
    onError: () => {
      addErrorMessage(t('Failed to delete escalation policy'));
    },
  });

  const handleDelete = () => {
    openConfirmModal({
      message: t('Are you sure you want to delete this escalation policy?'),
      onConfirm: () => deletePolicy(),
      priority: 'danger',
      confirmText: t('Delete'),
    });
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !policy) {
    return <LoadingError onRetry={refetch} />;
  }

  const action = (
    <Fragment>
      <Button
        size="sm"
        icon={<IconEdit />}
        to={`/settings/${organization.slug}/escalation-policies/${escalationPolicyId}/edit/`}
      >
        {t('Edit')}
      </Button>
      <Button
        size="sm"
        icon={<IconDelete />}
        priority="danger"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {t('Delete')}
      </Button>
    </Fragment>
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(policy.name, organization.slug, false)} />
      <SettingsPageHeader title={policy.name} action={action} />

      {policy.description && (
        <Panel>
          <PanelHeader>{t('Description')}</PanelHeader>
          <PanelBody>
            <p>{policy.description}</p>
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader>{t('Escalation Timeline')}</PanelHeader>
        <PanelBody>
          <Timeline.Container>
            <IncidentCreatedItem />
            {policy.steps.map(policyStep => (
              <Fragment key={policyStep.stepNumber}>
                <NotifyItem recipients={policyStep.recipients} />
                {policyStep.stepNumber < policy.steps.length && (
                  <EscalateAfterItem
                    minutes={Math.ceil(policyStep.escalateAfterSec / 60)}
                  />
                )}
              </Fragment>
            ))}
            {policy.repeatNTimes > 1 && <RepeatItem n={policy.repeatNTimes} />}
          </Timeline.Container>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const IncidentCreatedTimelineItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;

const EscalateAfterTimelineItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;

export default EscalationPolicyDetails;
