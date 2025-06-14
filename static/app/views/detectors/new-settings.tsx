import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
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
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {EditableDetectorName} from 'sentry/views/detectors/components/forms/editableDetectorName';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metricFormData';
import {
  DEFAULT_THRESHOLD_METRIC_FORM_DATA,
  getNewMetricDetectorData,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

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

export default function DetectorNewSettings() {
  const location = useLocation();
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const navigate = useNavigate();

  const {mutateAsync: createDetector} = useCreateDetector();

  const handleSubmit = useCallback<OnSubmitCallback>(
    async (data, _, __, ___, formModel) => {
      const hasErrors = formModel.validateForm();
      if (!hasErrors) {
        return;
      }

      const detector = await createDetector(
        getNewMetricDetectorData(data as MetricDetectorFormData)
      );
      navigate(makeMonitorDetailsPathname(organization.slug, detector.id));
    },
    [createDetector, navigate, organization.slug]
  );

  return (
    <FullHeightForm
      hideFooter
      initialData={{
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        // TODO: navigate them to the previous step if they don't have a project
        projectId: location.query.project ?? '',
        environment: location.query.environment || '',
        name: location.query.name || '',
      }}
      onSubmit={handleSubmit}
    >
      <NewDetectorDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <NewDetectorBreadcrumbs />
            <Layout.Title>
              <EditableDetectorName />
            </Layout.Title>
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <MetricDetectorForm />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary" type="submit">
            {t('Create Monitor')}
          </Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;

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
