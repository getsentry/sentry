import {Flex} from 'sentry/components/container/flex';
import {Button, LinkButton} from 'sentry/components/core/button';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorNewSettings() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewDetectorLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary">{t('Create Monitor')}</Button>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
