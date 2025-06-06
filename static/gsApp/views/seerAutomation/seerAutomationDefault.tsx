import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import {autofixAutomatingTuningField} from 'sentry/views/settings/projectSeer';

const SeerSelectLabel = styled('div')`
  margin-bottom: ${space(0.5)};
`;

export function SeerAutomationDefault() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'defaultAutofixAutomationTuning',
    label: <SeerSelectLabel>{t('Default Automation for New Projects')}</SeerSelectLabel>,
    help: tct(
      "Set the default automation level for newly-created projects. This setting can be overridden on a per-project basis.[break][break] Seer will find a root cause and solution for new issues that it thinks are actionable enough, but won't automatically open PRs.[break][break]Each run is charged at the [ratelink:standard billing rate] for Seer's Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
      {
        break: <br />,
        ratelink: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
        spendlink: (
          <Link to={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)} />
        ),
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
        defaultAutofixAutomationTuning:
          organization.defaultAutofixAutomationTuning ?? 'off',
      }}
    >
      <JsonForm forms={seerFormGroups} disabled={!canWrite} />
    </Form>
  );
}
