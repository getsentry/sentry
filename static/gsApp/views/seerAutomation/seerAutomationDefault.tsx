import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {
  autofixAutomatingTuningField,
  SEER_THRESHOLD_MAP,
} from 'sentry/views/settings/projectSeer';

export function SeerAutomationDefault() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'defaultAutofixAutomationTuning',
    label: t('Default for New Projects'),
    help: t(
      "Set the default automation level for newly-created projects. This setting can be overridden on a per-project basis. A 'Low' setting means Seer runs only on the most actionable issues, while a 'High' setting enables Seer to be more eager."
    ),
  } satisfies FieldObject;

  const seerFormGroups: JsonFormObject[] = [
    {
      title: t('General'),
      fields: [orgDefaultAutomationTuning],
    },
  ];
  return (
    <Form
      saveOnBlur
      apiMethod="PUT"
      apiEndpoint={`/organizations/${organization.slug}/`}
      allowUndo
      initialData={{
        defaultAutofixAutomationTuning: SEER_THRESHOLD_MAP.indexOf(
          organization.defaultAutofixAutomationTuning ?? 'off'
        ),
      }}
    >
      <JsonForm forms={seerFormGroups} disabled={!canWrite} />
    </Form>
  );
}
