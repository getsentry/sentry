import React from 'react';
import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
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
    label: <SeerSelectLabel>{t('Default Automation for Issue Scans')}</SeerSelectLabel>,
  };

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'defaultAutofixAutomationTuning',
    label: <SeerSelectLabel>{t('Default Automation for Issue Fixes')}</SeerSelectLabel>,
    visible: ({model}) => model?.getValue('defaultSeerScannerAutomation') === true,
  } satisfies FieldObject;

  const orgDefaultStoppingPoint = {
    name: 'defaultAutofixStoppingPoint',
    label: (
      <SeerSelectLabel>{t('Default Stopping Point for Automatic Fixes')}</SeerSelectLabel>
    ),
    help: () =>
      t(
        'Choose how far Seer should go without your approval when running automatically. This does not affect fixes that you manually start.'
      ),
    type: 'choice',
    options: [
      {
        value: 'solution',
        label: <SeerSelectLabel>{t('Solution (default)')}</SeerSelectLabel>,
        details: t('Seer will stop after planning out a solution.'),
      },
      {
        value: 'code_changes',
        label: <SeerSelectLabel>{t('Code Changes')}</SeerSelectLabel>,
        details: t('Seer will stop after writing the code changes.'),
      },
      {
        value: 'open_pr',
        label: <SeerSelectLabel>{t('Pull Request')}</SeerSelectLabel>,
        details: t('Seer will go all the way and open a pull request automatically.'),
      },
    ],
    saveOnBlur: true,
    saveMessage: t('Default stopping point updated'),
    visible: ({model}) =>
      model?.getValue('defaultSeerScannerAutomation') === true &&
      model?.getValue('defaultAutofixAutomationTuning') !== 'off',
  } satisfies FieldObject;

  const seerFormGroups: JsonFormObject[] = [
    {
      title: t('Default Automation for New Projects'),
      fields: [
        orgDefaultScannerAutomation,
        orgDefaultAutomationTuning,
        orgDefaultStoppingPoint,
      ],
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
        defaultAutofixStoppingPoint:
          (organization as any).defaultAutofixStoppingPoint ?? 'solution',
      }}
    >
      <JsonForm
        forms={seerFormGroups}
        disabled={!canWrite}
        renderHeader={() => <React.Fragment />}
      />
    </Form>
  );
}
