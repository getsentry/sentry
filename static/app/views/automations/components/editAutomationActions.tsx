import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useDeleteAutomationMutation,
  useUpdateAutomation,
} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

interface EditAutomationActionsProps {
  automation: Automation;
}

export function EditAutomationActions({automation}: EditAutomationActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: deleteAutomation, isPending: isDeleting} =
    useDeleteAutomationMutation();
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = useCallback(() => {
    const newEnabled = !automation.enabled;
    updateAutomation(
      {
        ...automation,
        enabled: newEnabled,
      },
      {
        onSuccess: () => {
          addSuccessMessage(
            newEnabled ? t('Automation enabled') : t('Automation disabled')
          );
        },
      }
    );
  }, [updateAutomation, automation]);

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: t('Are you sure you want to delete this automation?'),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: async () => {
        await deleteAutomation(automation.id);
        navigate(makeAutomationBasePathname(organization.slug));
      },
    });
  }, [deleteAutomation, automation.id, navigate, organization.slug]);

  return (
    <div>
      <ButtonBar>
        <Button priority="default" size="sm" onClick={toggleDisabled} busy={isUpdating}>
          {automation.enabled ? t('Disable') : t('Enable')}
        </Button>
        <Button
          priority="danger"
          onClick={handleDelete}
          disabled={isDeleting}
          busy={isDeleting}
          size="sm"
        >
          {t('Delete')}
        </Button>
        <Button type="submit" priority="primary" size="sm">
          {t('Save')}
        </Button>
      </ButtonBar>
    </div>
  );
}
