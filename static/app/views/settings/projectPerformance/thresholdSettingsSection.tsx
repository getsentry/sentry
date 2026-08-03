import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {
  CALCULATION_METHOD_OPTIONS,
  getThresholdQueryOptions,
  thresholdSettingsSchema,
  type ProjectThreshold,
  type ThresholdMetric,
} from './detectorSettings';

export function ThresholdSettingsSection({
  hasWriteAccess,
  isResetting,
  onResetAll,
  resetVersion,
  threshold,
}: {
  hasWriteAccess: boolean;
  isResetting: boolean;
  onResetAll: () => void;
  resetVersion: number;
  threshold: ProjectThreshold;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;

  const cacheThreshold = (data: ProjectThreshold) =>
    queryClient.setQueryData(
      getThresholdQueryOptions(organization.slug, projectSlug).queryKey,
      previous => ({json: data, headers: previous?.headers ?? {}})
    );

  return (
    <FieldGroup title={t('Threshold Settings')}>
      <AutoSaveForm
        key={`metric-${resetVersion}`}
        name="metric"
        schema={thresholdSettingsSchema}
        initialValue={
          threshold.metric === 'lcp' || threshold.metric === 'duration'
            ? threshold.metric
            : null
        }
        mutationOptions={{
          mutationFn: (data: {metric: ThresholdMetric}) =>
            fetchMutation<ProjectThreshold>({url: endpoint, method: 'POST', data}),
          onSuccess: data => {
            trackAnalytics('performance_views.project_transaction_threshold.change', {
              organization,
              from: threshold.metric,
              to: data.metric,
              key: 'metric',
            });
            cacheThreshold(data);
          },
        }}
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
              disabled={!hasWriteAccess}
              options={CALCULATION_METHOD_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        key={`threshold-${resetVersion}`}
        name="threshold"
        schema={thresholdSettingsSchema}
        initialValue={threshold.threshold ?? ''}
        mutationOptions={{
          mutationFn: (data: {threshold: string}) =>
            fetchMutation<ProjectThreshold>({url: endpoint, method: 'POST', data}),
          onSuccess: data => {
            trackAnalytics('performance_views.project_transaction_threshold.change', {
              organization,
              from: threshold.threshold,
              to: data.threshold,
              key: 'threshold',
            });
            cacheThreshold(data);
          },
        }}
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
              disabled={!hasWriteAccess}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <Flex justify="end">
        <Button onClick={onResetAll} busy={isResetting} disabled={!hasWriteAccess}>
          {t('Reset All')}
        </Button>
      </Flex>
    </FieldGroup>
  );
}
