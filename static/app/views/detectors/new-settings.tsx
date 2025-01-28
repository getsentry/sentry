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

export default function DetectorNewSettings() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewDetectorLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/monitors/new/">
            {t('Back')}
          </LinkButton>
          <Button priority="primary">{t('Create Monitor')}</Button>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
