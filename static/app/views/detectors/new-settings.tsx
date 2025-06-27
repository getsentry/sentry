import {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
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

const friendlyDetectorTypeMap: Record<DetectorType, string> = {
  error: t('Error'),
  metric_issue: t('Metric'),
  uptime_subscription: t('Crons'),
  uptime_domain_failure: t('Uptime'),
};

export default function DetectorNewSettings() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {projects, fetching: isFetchingProjects} = useProjects();
  // We'll likely use more query params on this page to open drawers, validate once
  const validatedRequiredQueryParams = useRef(false);

  useWorkflowEngineFeatureGate({redirect: true});

  // Kick user back to the previous step if they don't have a detectorType
  useLayoutEffect(() => {
    const {detectorType} = location.query;
    if (validatedRequiredQueryParams.current) {
      return;
    }

    if (!detectorType) {
      navigate(`${makeMonitorBasePathname(organization.slug)}new/`);
    }
    validatedRequiredQueryParams.current = true;
  }, [location.query, navigate, organization.slug]);

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

  // Defaults and data from the previous step passed in as query params
  const initialData = useMemo((): MetricDetectorFormData => {
    const defaultProjectId = projects.find(p => p.isMember)?.id ?? projects[0]?.id;

    return {
      ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
      projectId: (location.query.project as string) ?? defaultProjectId ?? '',
      environment: (location.query.environment as string | undefined) || '',
      name: (location.query.name as string | undefined) || '',
    };
  }, [location.query, projects]);

  if (isFetchingProjects) {
    return <LoadingIndicator />;
  }

  return (
    <FullHeightForm hideFooter initialData={initialData} onSubmit={handleSubmit}>
      <SentryDocumentTitle
        title={t(
          'New %s Monitor',
          friendlyDetectorTypeMap[location.query.detectorType as DetectorType]
        )}
      />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {
                  label: t(
                    'New %s Monitor',
                    friendlyDetectorTypeMap[location.query.detectorType as DetectorType]
                  ),
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

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
