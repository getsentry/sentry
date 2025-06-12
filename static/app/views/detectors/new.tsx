import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Form from 'sentry/components/forms/form';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
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
import {EditableDetectorTitle} from 'sentry/views/detectors/components/forms/editableDetectorTitle';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

function NewDetectorBreadcrumbs() {
  const title = useFormField<string>('title');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
        {label: title ? title : t('New Monitor')},
      ]}
    />
  );
}

function NewDetectorDocumentTitle() {
  const title = useFormField<string>('title');
  return <SentryDocumentTitle title={title ? title : t('New Monitor')} />;
}

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
      <NewDetectorDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <NewDetectorBreadcrumbs />
            <Layout.Title>
              <EditableDetectorTitle />
            </Layout.Title>
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <DetectorTypeForm />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
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

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;

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
