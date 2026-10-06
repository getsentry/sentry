import {Observer} from 'mobx-react-lite';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import type {FormModel} from 'sentry/components/forms/model';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useDeleteAutomationMutation,
  useUpdateAutomation,
} from 'sentry/views/automations/hooks';
import {useAutomationEditPermission} from 'sentry/views/automations/hooks/useCanEditAutomation';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';

interface EditAutomationActionsProps {
  automation: Automation;
  form: FormModel;
}

export function EditAutomationActions({automation, form}: EditAutomationActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {
    canEdit,
    disabledReason,
    isPending: isPermissionPending,
  } = useAutomationEditPermission(automation.id);
  const {mutateAsync: deleteAutomation, isPending: isDeleting} =
    useDeleteAutomationMutation();
  const {mutate: updateAutomation, isPending: isUpdating} = useUpdateAutomation();

  const toggleDisabled = () => {
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
  };

  const handleDelete = () => {
    openConfirmModal({
      message: t('Are you sure you want to delete this alert?'),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: async () => {
        await deleteAutomation(automation.id);
        navigate(makeAutomationBasePathname(organization.slug));
      },
    });
  };

  return (
    <div>
      <Grid flow="column" align="center" gap="md">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleDisabled}
          busy={isPermissionPending}
          disabled={!canEdit || isUpdating}
          tooltipProps={{title: disabledReason}}
        >
          {automation.enabled ? t('Disable') : t('Enable')}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          busy={isPermissionPending}
          disabled={!canEdit || isDeleting}
          tooltipProps={{title: disabledReason}}
          size="sm"
        >
          {t('Delete')}
        </Button>
        <Separator orientation="vertical" />
        <LinkButton
          variant="secondary"
          size="sm"
          to={makeAutomationDetailsPathname(organization.slug, automation.id)}
        >
          {t('Cancel')}
        </LinkButton>
        <Observer>
          {() => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              busy={form.isSaving || isPermissionPending}
              disabled={!canEdit}
              tooltipProps={{title: disabledReason}}
            >
              {t('Save')}
            </Button>
          )}
        </Observer>
      </Grid>
    </div>
  );
}
