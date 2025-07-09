import React from 'react';
import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
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
    label: <SeerSelectLabel>{t('Default for Automatic Issue Scans')}</SeerSelectLabel>,
  };

  const orgDefaultAutomationTuning = {
    ...autofixAutomatingTuningField,
    name: 'defaultAutofixAutomationTuning',
    label: <SeerSelectLabel>{t('Default for Automatic Issue Fixes')}</SeerSelectLabel>,
    visible: ({model}) => model?.getValue('defaultSeerScannerAutomation') === true,
  } satisfies FieldObject;

  const seerFormGroups: JsonFormObject[] = [
    {
      title: t('Default Automation for New Projects'),
      fields: [orgDefaultScannerAutomation, orgDefaultAutomationTuning],
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
      }}
    >
      <JsonForm
        forms={seerFormGroups}
        disabled={!canWrite}
        renderHeader={() => (
          <React.Fragment>
            <Alert type="info" system showIcon={false}>
              {t(
                'Set the default automation level for newly-created projects. This setting can be overridden on a per-project basis.'
              )}
            </Alert>
          </React.Fragment>
        )}
      />
    </Form>
  );
}
