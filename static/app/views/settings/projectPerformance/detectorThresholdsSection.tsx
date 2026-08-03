import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {Confirm} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {
  DetectorConfigAdmin,
  getPerformanceIssueSettingsQueryOptions,
  handleSuperUserError,
  projectDetectorSettingsId,
  regressionAdminSchema,
  type DetectorFieldGroup,
  type ProjectPerformanceSettings,
} from './detectorSettings';

export function AdminRegressionSettingsSection({
  performanceIssueSettings,
}: {
  performanceIssueSettings: ProjectPerformanceSettings;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;

  const cacheSetting = (setting: ProjectPerformanceSettings) =>
    queryClient.setQueryData(
      getPerformanceIssueSettingsQueryOptions(organization.slug, projectSlug).queryKey,
      previous =>
        previous
          ? {json: {...previous.json, ...setting}, headers: previous.headers}
          : previous
    );

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
        mutationOptions={{
          mutationFn: (data: {
            transaction_duration_regression_detection_enabled: boolean;
          }) => fetchMutation({url: endpoint, method: 'PUT', data}),
          onSuccess: (_data, variables) => cacheSetting(variables),
          onError: handleSuperUserError,
        }}
      >
        {field => (
          <field.Layout.Row label={t('Transaction Duration Regression Enabled')}>
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
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
        mutationOptions={{
          mutationFn: (data: {function_duration_regression_detection_enabled: boolean}) =>
            fetchMutation({url: endpoint, method: 'PUT', data}),
          onSuccess: (_data, variables) => cacheSetting(variables),
          onError: handleSuperUserError,
        }}
      >
        {field => (
          <field.Layout.Row label={t('Function Duration Regression Enabled')}>
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
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
  onResetAll,
  performanceIssueSettings,
}: {
  detectorGroups: DetectorFieldGroup[];
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  performanceIssueSettings: ProjectPerformanceSettings;
}) {
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
            disabled={!hasWriteAccess || areAllConfigurationsDisabled}
          >
            <Button busy={isResetting}>{t('Reset All Thresholds')}</Button>
          </Confirm>
        </Flex>
      </FieldGroup>
    </Container>
  );
}
