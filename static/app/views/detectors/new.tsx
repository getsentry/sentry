import {Button, LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
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
          <Button priority="default">{t('Cancel')}</Button>
          <LinkButton priority="primary" to="/monitors/new/settings">
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
