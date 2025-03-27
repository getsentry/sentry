import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';

export default function DetectorNew() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewDetectorLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/issues/monitors">
            {t('Cancel')}
          </LinkButton>
          <LinkButton priority="primary" to="/issues/monitors/new/settings">
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
