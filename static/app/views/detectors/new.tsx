import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Form from 'sentry/components/forms/form';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {DetectorTypeForm} from 'sentry/views/detectors/components/detectorTypeForm';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorNew() {
  const navigate = useNavigate();
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const {projects} = useProjects();

  const defaultProject = projects.find(p => p.isMember) ?? projects[0];

  return (
    <FullHeightForm
      onSubmit={data => {
        navigate({
          pathname: `${makeMonitorBasePathname(organization.slug)}new/settings/`,
          // Filter out empty values
          query: Object.fromEntries(
            Object.entries(data).filter(([_, value]) => value !== '')
          ),
        });
      }}
      hideFooter
      initialData={{
        detectorType: 'metric',
        project: defaultProject?.id,
        title: '',
        environment: '',
      }}
    >
      <NewDetectorLayout>
        <DetectorTypeForm />
      </NewDetectorLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to={makeMonitorBasePathname(organization.slug)}>
            {t('Cancel')}
          </LinkButton>
          <Button priority="primary" type="submit">
            {t('Next')}
          </Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

// Make the form full height
const FullHeightForm = styled(Form)`
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;

  & > div:first-child {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
`;
