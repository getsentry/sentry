import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DetectorTypeForm} from 'sentry/views/detectors/components/detectorTypeForm';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorNew() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const location = useLocation();

  return (
    <NewDetectorLayout>
      <DetectorTypeForm />
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to={makeMonitorBasePathname(organization.slug)}>
            {t('Cancel')}
          </LinkButton>
          <LinkButton
            priority="primary"
            to={{
              pathname: `${makeMonitorBasePathname(organization.slug)}new/settings/`,
              query: location.query,
            }}
          >
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
