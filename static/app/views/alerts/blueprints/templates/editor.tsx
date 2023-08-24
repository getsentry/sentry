import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {logException} from 'sentry/utils/logging';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintEditorForm from 'sentry/views/alerts/blueprints/form';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';

function AlertTemplateEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const api = useApi();
  const {templateId = 'new'} = router.params;

  const {data: template = {} as AlertTemplate} = useApiQuery<AlertTemplate>(
    [`/organizations/${organization.slug}/alert-templates/${templateId}/`],
    {staleTime: 0, enabled: templateId !== 'new'}
  );

  async function handleSubmit(data) {
    const path =
      templateId === 'new'
        ? `/organizations/${organization.slug}/alert-templates/`
        : `/organizations/${organization.slug}/alert-templates/${templateId}/`;

    const method = templateId === 'new' ? 'POST' : 'PUT';
    try {
      await api.requestPromise(path, {
        method,
        data: {
          owner: data?.owner ?? null,
          issue_alert_data: {
            conditions: data.conditions,
            filters: data.filters,
            filterMatch: data.filterMatch,
            actionMatch: data.actionMatch,
            frequency: data.frequency,
          },
          is_manual: false,
          name: data.name,
          description: data.description,
        },
      });
      addSuccessMessage(t('Saved template!'));
    } catch (err) {
      logException(err);
      addErrorMessage(t('Unable to save template'));
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(err.responseJSON));
    }
  }

  return (
    <AlertBlueprintEditorForm
      type="template"
      template={template}
      identifier={templateId}
      help={t('Setup a standard series of actions for Sentry to run for you')}
      onSubmit={handleSubmit}
    />
  );
}

export default AlertTemplateEditor;
