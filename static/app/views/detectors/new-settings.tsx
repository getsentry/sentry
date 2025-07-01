import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {DetectorForm} from 'sentry/views/detectors/components/forms';
import type {
  DetectorFormData,
  EditableDetectorType,
} from 'sentry/views/detectors/components/forms/config';
import {
  canEditDetector,
  DETECTOR_FORM_CONFIG,
} from 'sentry/views/detectors/components/forms/config';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

const friendlyDetectorTypeMap: Record<EditableDetectorType, string> = {
  metric_issue: t('Metric'),
  uptime_domain_failure: t('Uptime'),
};

function NewDetectorContent({detectorType}: {detectorType: EditableDetectorType}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  useWorkflowEngineFeatureGate({redirect: true});
  const {mutateAsync: createDetector} = useCreateDetector();

  const config = DETECTOR_FORM_CONFIG[detectorType];

  const handleSubmit = useCallback<OnSubmitCallback>(
    async (data, _, __, ___, formModel) => {
      const hasErrors = formModel.validateForm();
      if (!hasErrors) {
        return;
      }

      try {
        const detector = await createDetector(
          config.formDataToEndpointPayload(data as any)
        );
        navigate(makeMonitorDetailsPathname(organization.slug, detector.id));
      } catch (error) {
        addErrorMessage(t('Unable to create monitor'));
      }
    },
    [config, createDetector, navigate, organization.slug]
  );

  // Defaults and data from the previous step passed in as query params
  const initialData = useMemo((): Partial<DetectorFormData> => {
    const defaultProjectId = projects.find(p => p.isMember)?.id ?? projects[0]?.id;

    return {
      projectId: (location.query.project as string) ?? defaultProjectId ?? '',
      environment: (location.query.environment as string | undefined) || '',
      name: (location.query.name as string | undefined) || '',
      owner: (location.query.owner as string | undefined) || '',
      ...config.getInitialFormData(),
    };
  }, [
    config,
    location.query.environment,
    location.query.name,
    location.query.owner,
    location.query.project,
    projects,
  ]);

  return (
    <FullHeightForm hideFooter initialData={initialData} onSubmit={handleSubmit}>
      <SentryDocumentTitle
        title={t('New %s Monitor', friendlyDetectorTypeMap[detectorType])}
      />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {
                  label: t('New %s Monitor', friendlyDetectorTypeMap[detectorType]),
                },
              ]}
            />
            <DetectorBaseFields />
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <DetectorForm detectorType={location.query.detectorType as DetectorType} />
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

export default function DetectorNewSettings() {
  const location = useLocation();
  const {fetching: isFetchingProjects} = useProjects();
  const detectorType = location.query.detectorType as DetectorType;

  if (!canEditDetector(detectorType)) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LoadingError message={t('This monitor type is not editable')} />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  if (isFetchingProjects) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LoadingIndicator />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  return <NewDetectorContent detectorType={detectorType} />;
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
