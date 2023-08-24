import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {logException} from 'sentry/utils/logging';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintEditorForm from 'sentry/views/alerts/blueprints/form';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';

function AlertProcedureEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const api = useApi();
  const {procedureId = 'new'} = router.params;

  const {data: procedure = {} as AlertProcedure} = useApiQuery<AlertProcedure>(
    [`/organizations/${organization.slug}/alert-procedures/${procedureId}/`],
    {staleTime: 0, enabled: procedureId !== 'new'}
  );

  async function handleSubmit(data) {
    const path =
      procedureId === 'new'
        ? `/organizations/${organization.slug}/alert-procedures/`
        : `/organizations/${organization.slug}/alert-procedures/${procedureId}/`;

    const method = procedureId === 'new' ? 'POST' : 'PUT';
    try {
      await api.requestPromise(path, {
        method,
        data: {
          owner: data?.owner ?? null,
          issue_alert_actions: data?.actions,
          label: data.name,
          description: data.description,
        },
      });
      addSuccessMessage(t('Saved procedure!'));
    } catch (err) {
      logException(err);
      addErrorMessage(t('Unable to save procedure'));
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(err.responseJSON));
    }
  }
  return (
    <AlertBlueprintEditorForm
      type="procedure"
      procedure={procedure}
      identifier={procedureId}
      help={t('Setup a standard series of actions for Sentry to run for you')}
      onSubmit={handleSubmit}
    />
  );
}

export default AlertProcedureEditor;
