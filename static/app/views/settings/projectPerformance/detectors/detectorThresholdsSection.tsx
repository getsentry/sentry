import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {Confirm} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';

import {projectDetectorSettingsId, type DetectorFieldGroup} from './detectorFieldGroups';
import {
  DetectorConfigAdmin,
  handleSuperUserError,
  regressionAdminSchema,
  type ProjectPerformanceSettings,
} from './detectorSettings';
import {useDetectorFieldMutationOptions} from './useDetectorFieldMutationOptions';

type AdminRegressionSettingsSectionProps = {
  hasWriteAccess: boolean;
  isResetting: boolean;
  performanceIssueSettings: ProjectPerformanceSettings;
};

type DetectorThresholdsSectionProps = {
  detectorGroups: DetectorFieldGroup[];
  hasWriteAccess: boolean;
  isResetting: boolean;
  isSaving: boolean;
  onResetAll: () => void;
  performanceIssueSettings: ProjectPerformanceSettings;
};

export function AdminRegressionSettingsSection({
  hasWriteAccess,
  isResetting,
  performanceIssueSettings,
}: AdminRegressionSettingsSectionProps) {
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const mutationOptions = useDetectorFieldMutationOptions({
    projectSlug,
    onError: handleSuperUserError,
  });

  return (
    <FieldGroup
      title={t('### INTERNAL ONLY ### - Performance Issues Admin Detector Settings')}
    >
      <AutoSaveForm
        name="transaction_duration_regression_detection_enabled"
        schema={regressionAdminSchema}
        initialValue={Boolean(
          performanceIssueSettings[
            DetectorConfigAdmin.TRANSACTION_DURATION_REGRESSION_ENABLED
          ]
        )}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Transaction Duration Regression Enabled')}>
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={!hasWriteAccess || isResetting}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
      <AutoSaveForm
        name="function_duration_regression_detection_enabled"
        schema={regressionAdminSchema}
        initialValue={Boolean(
          performanceIssueSettings[
            DetectorConfigAdmin.FUNCTION_DURATION_REGRESSION_ENABLED
          ]
        )}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Function Duration Regression Enabled')}>
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={!hasWriteAccess || isResetting}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

export function DetectorThresholdsSection({
  detectorGroups,
  hasWriteAccess,
  isResetting,
  isSaving,
  onResetAll,
  performanceIssueSettings,
}: DetectorThresholdsSectionProps) {
  const areAllConfigurationsDisabled = Object.values(DetectorConfigAdmin).every(
    threshold => !performanceIssueSettings[threshold]
  );

  return (
    <Container id={projectDetectorSettingsId}>
      <FieldGroup title={t('Performance Issues - Detector Threshold Settings')}>
        {detectorGroups
          .filter(group => group.fields.some(Boolean))
          .map(group => (
            <Disclosure key={group.title} defaultExpanded={!group.initiallyCollapsed}>
              <Disclosure.Title>{group.title}</Disclosure.Title>
              <Disclosure.Content>
                <Stack gap="lg">{group.fields}</Stack>
              </Disclosure.Content>
            </Disclosure>
          ))}
        <Flex justify="end">
          <Confirm
            message={t('Are you sure you wish to reset all detector thresholds?')}
            onConfirm={onResetAll}
            disabled={
              !hasWriteAccess || areAllConfigurationsDisabled || isResetting || isSaving
            }
          >
            <Button busy={isResetting}>{t('Reset All Thresholds')}</Button>
          </Confirm>
        </Flex>
      </FieldGroup>
    </Container>
  );
}
