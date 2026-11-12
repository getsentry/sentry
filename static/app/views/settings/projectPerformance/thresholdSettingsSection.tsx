import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';

import {
  CALCULATION_METHOD_OPTIONS,
  thresholdSettingsSchema,
  type ProjectThreshold,
} from './projectPerformanceSettings';
import {useThresholdSettingsMutationOptions} from './useThresholdSettingsMutationOptions';

type ThresholdSettingsSectionProps = {
  hasWriteAccess: boolean;
  isResetting: boolean;
  isSaving: boolean;
  onResetAll: () => void;
  threshold: ProjectThreshold;
};

export function ThresholdSettingsSection({
  hasWriteAccess,
  isResetting,
  isSaving,
  onResetAll,
  threshold,
}: ThresholdSettingsSectionProps) {
  const {metricMutationOptions, thresholdMutationOptions} =
    useThresholdSettingsMutationOptions(threshold);

  return (
    <FieldGroup title={t('Threshold Settings')}>
      <AutoSaveForm
        name="metric"
        schema={thresholdSettingsSchema}
        initialValue={
          threshold.metric === 'lcp' || threshold.metric === 'duration'
            ? threshold.metric
            : null
        }
        mutationOptions={metricMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Calculation Method')}
            hintText={tct(
              'This determines which duration is used to set your thresholds. By default, we use transaction duration which measures the entire length of the transaction. You can also set this to use a [link:Web Vital].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/" />
                ),
              }
            )}
          >
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              disabled={!hasWriteAccess || isResetting}
              options={CALCULATION_METHOD_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="threshold"
        schema={thresholdSettingsSchema}
        initialValue={threshold.threshold ?? ''}
        mutationOptions={thresholdMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Response Time Threshold (ms)')}
            hintText={tct(
              'Define what a satisfactory response time is based on the calculation method above. This will affect how your [link1:Apdex] and [link2:User Misery] thresholds are calculated. For example, misery will be 4x your satisfactory response time.',
              {
                link1: (
                  <ExternalLink href="https://docs.sentry.io/performance-monitoring/performance/metrics/#apdex" />
                ),
                link2: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#user-misery" />
                ),
              }
            )}
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={t('300')}
              disabled={!hasWriteAccess || isResetting}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <Flex justify="end">
        <Button
          onClick={onResetAll}
          busy={isResetting}
          disabled={!hasWriteAccess || isResetting || isSaving}
        >
          {t('Reset All')}
        </Button>
      </Flex>
    </FieldGroup>
  );
}
