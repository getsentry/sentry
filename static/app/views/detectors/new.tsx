import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
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
        environment: '',
      }}
    >
      <SentryDocumentTitle title={t('New Monitor')} />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {label: t('New Monitor')},
              ]}
            />
            <Layout.Title>{t('New Monitor')}</Layout.Title>
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
