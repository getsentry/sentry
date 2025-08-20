import {Fragment, memo, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import EditableText from 'sentry/components/editableText';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Timeline} from 'sentry/components/timeline';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {
  IconAdd,
  IconClock,
  IconDelete,
  IconExclamation,
  IconMegaphone,
  IconRefresh,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {browserHistory} from 'sentry/utils/browserHistory';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import EscalationAssigneeSelector, {
  type AssignableEntity,
} from './escalationAssigneeSelector';
import type {
  EscalationPolicy,
  EscalationPolicyStepRecipient,
  RotationSchedule,
} from './index';

const NotifyItem = memo(function NotifyItem({
  onAssigneeChange,
  onDeleteStep,
  recipients,
  stepNumber,
  isUpdating,
  canDelete,
}: {
  onAssigneeChange: (stepNumber: number, assignedActor: AssignableEntity | null) => void;
  recipients: EscalationPolicyStepRecipient[];
  stepNumber: number;
  canDelete?: boolean;
  isUpdating?: boolean;
  onDeleteStep?: (stepNumber: number) => void;
}) {
  // Convert recipients to the format expected by EscalationAssigneeSelector
  const getInitialAssignee = (): AssignableEntity | null => {
    const firstRecipient = recipients[0];
    if (!firstRecipient) return null;

    if (firstRecipient.type === 'user') {
      return {
        type: 'user',
        assignee: firstRecipient.data as User,
      };
    }
    if (firstRecipient.type === 'team') {
      return {
        type: 'team',
        assignee: firstRecipient.data as Team,
      };
    }
    if (firstRecipient.type === 'schedule') {
      return {
        type: 'schedule',
        assignee: firstRecipient.data,
      };
    }
    return null;
  };

  const [selectedAssignee, setSelectedAssignee] = useState<AssignableEntity | null>(
    getInitialAssignee()
  );

  const handleAssigneeChange = (newAssignee: AssignableEntity | null) => {
    setSelectedAssignee(newAssignee);
    onAssigneeChange(stepNumber, newAssignee);
  };

  return (
    <Timeline.Item
      title={
        <StepTitleWrapper>
          {t('Notify:')}
          {canDelete && onDeleteStep && (
            <DeleteStepButton
              size="xs"
              borderless
              icon={<IconDelete />}
              onClick={() => onDeleteStep(stepNumber)}
              aria-label={t('Delete step')}
              disabled={isUpdating}
            />
          )}
        </StepTitleWrapper>
      }
      icon={<IconMegaphone size="xs" />}
      colorConfig={{
        title: 'purple400',
        icon: 'purple400',
        iconBorder: 'purple200',
      }}
    >
      <EscalationAssigneeSelector
        selectedAssignee={selectedAssignee}
        onAssigneeChange={handleAssigneeChange}
        loading={isUpdating}
      />
    </Timeline.Item>
  );
});

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

const EscalateAfterItem = memo(function EscalateAfterItem({
  minutes,
  stepNumber,
  onTimeChange,
  isUpdating,
}: {
  minutes: number;
  onTimeChange: (stepNumber: number, minutes: number) => void;
  stepNumber: number;
  isUpdating?: boolean;
}) {
  const handleTimeChange = (newMinutes: string) => {
    const parsedMinutes = parseInt(newMinutes, 10);
    if (!isNaN(parsedMinutes) && parsedMinutes > 0) {
      onTimeChange(stepNumber, parsedMinutes);
    }
  };

  return (
    <EscalateAfterTimelineItem
      title={
        <Fragment>
          {t('Escalate after ')}
          <EditableTimeWrapper>
            <EditableText
              value={minutes.toString()}
              onChange={handleTimeChange}
              isDisabled={isUpdating}
              errorMessage={t('Minutes must be a positive number')}
            />
          </EditableTimeWrapper>{' '}
          {t('minutes if not acknowledged')}
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
});

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
  const params = useParams();
  const escalationPolicyId = (params as any).escalationPolicyId;
  const queryClient = useQueryClient();

  const queryKey = [
    `/organizations/${organization.slug}/escalation-policies/${escalationPolicyId}/`,
  ];

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

  const {mutate: updatePolicy, isPending: isUpdating} = useMutation({
    mutationFn: (payload: any) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/escalation-policies/`,
        {
          method: 'PUT',
          data: payload,
        }
      );
    },
    onSuccess: updatedPolicy => {
      addSuccessMessage(t('Escalation policy updated successfully'));
      setApiQueryData(queryClient, queryKey, updatedPolicy);
    },
    onError: () => {
      addErrorMessage(t('Failed to update escalation policy'));
    },
  });

  const handleAddStep = () => {
    if (!policy) return;

    const sortedSteps = [...policy.steps].sort((a, b) => a.stepNumber - b.stepNumber);

    const payload: any = {
      id: Number(policy.id),
      name: policy.name,
      repeat_n_times: policy.repeatNTimes,
    };

    if (policy.description) {
      payload.description = policy.description;
    }

    // Add existing steps
    payload.steps = sortedSteps.map(step => ({
      escalate_after_sec: step.escalateAfterSec,
      recipients: step.recipients.map(recipient => {
        if (recipient.type === 'user') {
          return {user_id: Number((recipient.data as User).id)};
        }
        if (recipient.type === 'team') {
          return {team_id: Number((recipient.data as Team).id)};
        }
        if (recipient.type === 'schedule') {
          return {schedule_id: Number((recipient.data as any).id)};
        }
        return {};
      }),
    }));

    // Add new step with default values
    payload.steps.push({
      escalate_after_sec: 300, // Default 5 minutes
      recipients: [],
    });

    updatePolicy(payload);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!policy || newTitle === policy.name) return;

    const sortedSteps = [...policy.steps].sort((a, b) => a.stepNumber - b.stepNumber);

    const payload: any = {
      id: Number(policy.id),
      name: newTitle,
      repeat_n_times: policy.repeatNTimes,
    };

    if (policy.description) {
      payload.description = policy.description;
    }

    payload.steps = sortedSteps.map(step => ({
      escalate_after_sec: step.escalateAfterSec,
      recipients: step.recipients.map(recipient => {
        if (recipient.type === 'user') {
          return {user_id: Number((recipient.data as User).id)};
        }
        if (recipient.type === 'team') {
          return {team_id: Number((recipient.data as Team).id)};
        }
        if (recipient.type === 'schedule') {
          return {schedule_id: Number((recipient.data as any).id)};
        }
        return {};
      }),
    }));

    updatePolicy(payload);
  };

  const handleTimeChange = useCallback(
    (stepNumber: number, minutes: number) => {
      if (!policy) return;

      const sortedSteps = [...policy.steps].sort((a, b) => a.stepNumber - b.stepNumber);

      const payload: any = {
        id: Number(policy.id),
        name: policy.name,
        repeat_n_times: policy.repeatNTimes,
      };

      if (policy.description) {
        payload.description = policy.description;
      }

      payload.steps = sortedSteps.map(step => {
        if (step.stepNumber === stepNumber) {
          return {
            escalate_after_sec: minutes * 60, // Convert minutes to seconds
            recipients: step.recipients.map(recipient => {
              if (recipient.type === 'user') {
                return {user_id: Number((recipient.data as User).id)};
              }
              if (recipient.type === 'team') {
                return {team_id: Number((recipient.data as Team).id)};
              }
              if (recipient.type === 'schedule') {
                return {schedule_id: Number((recipient.data as any).id)};
              }
              return {};
            }),
          };
        }
        // For other steps, keep existing values
        return {
          escalate_after_sec: step.escalateAfterSec,
          recipients: step.recipients.map(recipient => {
            if (recipient.type === 'user') {
              return {user_id: Number((recipient.data as User).id)};
            }
            if (recipient.type === 'team') {
              return {team_id: Number((recipient.data as Team).id)};
            }
            if (recipient.type === 'schedule') {
              return {schedule_id: Number((recipient.data as any).id)};
            }
            return {};
          }),
        };
      });

      updatePolicy(payload);
    },
    [policy, updatePolicy]
  );

  const handleDeleteStep = useCallback(
    (stepNumber: number) => {
      if (!policy || policy.steps.length <= 1) return;

      const sortedSteps = [...policy.steps].sort((a, b) => a.stepNumber - b.stepNumber);

      const payload: any = {
        id: Number(policy.id),
        name: policy.name,
        repeat_n_times: policy.repeatNTimes,
      };

      if (policy.description) {
        payload.description = policy.description;
      }

      const remainingSteps = sortedSteps.filter(step => step.stepNumber !== stepNumber);

      payload.steps = remainingSteps.map(step => ({
        escalate_after_sec: step.escalateAfterSec,
        recipients: step.recipients.map(recipient => {
          if (recipient.type === 'user') {
            return {user_id: Number((recipient.data as User).id)};
          }
          if (recipient.type === 'team') {
            return {team_id: Number((recipient.data as Team).id)};
          }
          if (recipient.type === 'schedule') {
            return {schedule_id: Number((recipient.data as any).id)};
          }
          return {};
        }),
      }));

      updatePolicy(payload);
    },
    [policy, updatePolicy]
  );

  const handleAssigneeChange = useCallback(
    (stepNumber: number, newAssignee: AssignableEntity | null) => {
      if (!policy) return;

      // Create the new recipients array - backend expects schedule_id, team_id, or user_id
      const newRecipients: any[] = [];

      if (newAssignee) {
        if (newAssignee.type === 'user') {
          const user = newAssignee.assignee as User;
          newRecipients.push({
            user_id: Number(user.id),
          });
        } else if (newAssignee.type === 'team') {
          const team = newAssignee.assignee as Team;
          newRecipients.push({
            team_id: Number(team.id),
          });
        } else if (newAssignee.type === 'schedule') {
          const schedule = newAssignee.assignee as RotationSchedule;
          newRecipients.push({
            schedule_id: Number(schedule.id),
          });
        }
      }

      // Prepare the payload in the format the backend expects
      // The backend expects steps in order without step_number (it auto-generates them)
      const sortedSteps = [...policy.steps].sort((a, b) => a.stepNumber - b.stepNumber);

      const payload: any = {
        id: Number(policy.id),
        name: policy.name,
        repeat_n_times: policy.repeatNTimes,
      };

      // Only include description if it's not empty
      if (policy.description) {
        payload.description = policy.description;
      }

      payload.steps = sortedSteps.map(step => {
        if (step.stepNumber === stepNumber) {
          return {
            escalate_after_sec: step.escalateAfterSec,
            recipients: newRecipients,
          };
        }
        // For other steps, convert existing recipients to the correct format
        const existingRecipients = step.recipients.map(recipient => {
          if (recipient.type === 'user') {
            return {user_id: Number((recipient.data as User).id)};
          }
          if (recipient.type === 'team') {
            return {team_id: Number((recipient.data as Team).id)};
          }
          if (recipient.type === 'schedule') {
            return {schedule_id: Number((recipient.data as any).id)};
          }
          return {};
        });
        return {
          escalate_after_sec: step.escalateAfterSec,
          recipients: existingRecipients,
        };
      });

      // Call the mutation to update the policy
      updatePolicy(payload);
    },
    [policy, updatePolicy]
  );

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
    <Button
      size="sm"
      icon={<IconDelete />}
      priority="danger"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {t('Delete')}
    </Button>
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(policy.name, organization.slug, false)} />
      <SettingsPageHeader
        title={
          <EditableText
            value={policy.name}
            onChange={handleTitleChange}
            isDisabled={isUpdating}
            errorMessage={t('Name is required')}
          />
        }
        action={action}
      />

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
                <NotifyItem
                  recipients={policyStep.recipients}
                  stepNumber={policyStep.stepNumber}
                  onAssigneeChange={handleAssigneeChange}
                  onDeleteStep={handleDeleteStep}
                  isUpdating={isUpdating}
                  canDelete={policy.steps.length > 1}
                />
                {policyStep.stepNumber < policy.steps.length && (
                  <EscalateAfterItem
                    minutes={Math.ceil(policyStep.escalateAfterSec / 60)}
                    stepNumber={policyStep.stepNumber}
                    onTimeChange={handleTimeChange}
                    isUpdating={isUpdating}
                  />
                )}
              </Fragment>
            ))}
            {policy.repeatNTimes > 1 && <RepeatItem n={policy.repeatNTimes} />}
          </Timeline.Container>
          <AddStepButton>
            <PurpleTextButton
              borderless
              icon={<IconAdd />}
              size="xs"
              onClick={handleAddStep}
              disabled={isUpdating}
            >
              {t('Add New Step')}
            </PurpleTextButton>
          </AddStepButton>
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

const AddStepButton = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  display: flex;
  justify-content: center;
`;

const EditableTimeWrapper = styled('span')`
  text-decoration: underline;
  display: inline-block;
  min-width: 20px;
`;

const StepTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const DeleteStepButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

export default EscalationPolicyDetails;
