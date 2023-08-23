import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintEditorForm from 'sentry/views/alerts/blueprints/form';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';

function AlertProcedureEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const {procedureId = 'new'} = router.params;

  const {data: procedure = {} as AlertProcedure} = useApiQuery<AlertProcedure>(
    [`/organizations/${organization.slug}/alert-procedures/${procedureId}/`],
    {staleTime: 0, enabled: procedureId !== 'new'}
  );
  return (
    <AlertBlueprintEditorForm
      type="procedure"
      procedure={procedure}
      identifier={procedureId}
      help={t('Setup a standard series of actions for Sentry to run for you')}
      onSubmit={() => {}}
    />
  );
}

export default AlertProcedureEditor;
