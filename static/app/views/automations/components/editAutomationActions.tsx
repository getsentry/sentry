import {useCallback} from 'react';
import {Observer} from 'mobx-react-lite';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import type FormModel from 'sentry/components/forms/model';
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
  form: FormModel;
}

export function EditAutomationActions({automation, form}: EditAutomationActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: deleteAutomation, isPending: isDeleting} =
    useDeleteAutomationMutation();
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = useCallback(() => {
    const newEnabled = !automation.enabled;
    updateAutomation(
      {
        id: automation.id,
        name: automation.name,
        enabled: newEnabled,
      },
      {
        onSuccess: data => {
          addSuccessMessage(data.enabled ? t('Alert enabled') : t('Alert disabled'));
        },
      }
    );
  }, [updateAutomation, automation]);

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: t('Are you sure you want to delete this alert?'),
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
        <Button
          priority="default"
          size="sm"
          onClick={toggleDisabled}
          disabled={isUpdating}
        >
          {automation.enabled ? t('Disable') : t('Enable')}
        </Button>
        <Button priority="danger" onClick={handleDelete} disabled={isDeleting} size="sm">
          {t('Delete')}
        </Button>
        <Observer>
          {() => (
            <Button type="submit" priority="primary" size="sm" disabled={form.isSaving}>
              {t('Save')}
            </Button>
          )}
        </Observer>
      </ButtonBar>
    </div>
  );
}
