import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {autofixAutomatingTuningField} from 'sentry/views/settings/projectSeer';

export function SeerAutomationDefault() {
  const organization = useOrganization();

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'orgDefaultAutofixAutomationTuning',
    label: t('Default for new projects'),
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
        orgDefaultAutofixAutomationTuning: 'off',
      }}
    >
      <JsonForm forms={seerFormGroups} />
    </Form>
  );
}
