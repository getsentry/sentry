import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';
import {
  autofixAutomatingTuningField,
  seerScannerAutomationField,
} from 'sentry/views/settings/projectSeer';

const SeerSelectLabel = styled('div')`
  margin-bottom: ${space(0.5)};
`;

export function SeerAutomationDefault() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const orgDefaultScannerAutomation: FieldObject = {
    ...seerScannerAutomationField,
    name: 'defaultSeerScannerAutomation',
    label: <SeerSelectLabel>{t('Default for Issue Scans')}</SeerSelectLabel>,
  };

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'defaultAutofixAutomationTuning',
    label: <SeerSelectLabel>{t('Default for Auto-Triggered Fixes')}</SeerSelectLabel>,
    visible: ({model}) => model?.getValue('defaultSeerScannerAutomation') === true,
  } satisfies FieldObject;

  const orgEnableSeerEnhancedAlerts: FieldObject = {
    name: 'enableSeerEnhancedAlerts',
    type: 'boolean',
    label: <SeerSelectLabel>{t('Enable Enhanced Alerts')}</SeerSelectLabel>,
    help: t(
      'Seer will provide extra context in supported alerts to make them more informative at a glance.'
    ),
  };

  const orgEnableSeerCoding: FieldObject = {
    name: 'enableSeerCoding',
    type: 'boolean',
    label: <SeerSelectLabel>{t('Enable Code Generation')}</SeerSelectLabel>,
    help: t('Allow members to use Seer to write code.'),
  };

  const seerFormGroups: JsonFormObject[] = [
    {
      title: t('Default Automation for New Projects'),
      fields: [orgDefaultScannerAutomation, orgDefaultAutomationTuning],
    },
    {
      title: t('Advanced Settings'),
      fields: [orgEnableSeerEnhancedAlerts, orgEnableSeerCoding],
    },
  ];
  return (
    <Form
      saveOnBlur
      apiMethod="PUT"
      apiEndpoint={`/organizations/${organization.slug}/`}
      allowUndo
      initialData={{
        defaultSeerScannerAutomation: organization.defaultSeerScannerAutomation ?? false,
        defaultAutofixAutomationTuning:
          organization.defaultAutofixAutomationTuning ?? 'off',
        enableSeerEnhancedAlerts: organization.enableSeerEnhancedAlerts ?? true,
        enableSeerCoding: organization.enableSeerCoding ?? true,
      }}
    >
      {!canWrite && <OrganizationPermissionAlert />}
      <JsonForm forms={seerFormGroups} disabled={!canWrite} />
    </Form>
  );
}
