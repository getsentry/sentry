import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
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
    help: tct(
      "Set the default automation level for newly-created projects. This setting can be overridden on a per-project basis.[break][break]A 'Low' setting means Seer runs only on the most actionable issues, while a 'High' setting enables Seer to help with more issues.  Seer will find a root cause and solution, but won't automatically open PRs.[break][break]Each run is charged at the [ratelink:standard billing rate] for Seer's Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
      {
        break: <br />,
        ratelink: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
        spendlink: <Link to={'docs.sentry.io/todo'} />,
      }
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
