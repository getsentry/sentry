import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';

export default function DetectorNewSettings() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewDetectorLayout>
      <MetricDetectorForm />
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/issues/monitors/new">
            {t('Back')}
          </LinkButton>
          <LinkButton priority="primary" to="/issues/monitors/1">
            {t('Create Monitor')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
