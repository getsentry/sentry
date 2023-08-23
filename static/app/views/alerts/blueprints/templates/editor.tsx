import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintEditorForm from 'sentry/views/alerts/blueprints/form';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';

function AlertTemplateEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const {templateId = 'new'} = router.params;

  const {data: template = {} as AlertTemplate} = useApiQuery<AlertTemplate>(
    [`/organizations/${organization.slug}/alert-templates/${templateId}/`],
    {staleTime: 0, enabled: templateId !== 'new'}
  );

  return (
    <AlertBlueprintEditorForm
      type="template"
      template={template}
      identifier={templateId}
      help={t('Setup a standard series of actions for Sentry to run for you')}
      onSubmit={() => {}}
    />
  );
}

export default AlertTemplateEditor;
