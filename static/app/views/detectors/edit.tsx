import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

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
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metricFormData';
import {
  getMetricDetectorFormData,
  getNewMetricDetectorData,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {useDetectorQuery, useUpdateDetector} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

function DetectorBreadcrumbs({detectorId}: {detectorId: string}) {
  const title = useMetricDetectorFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
        {label: title, to: makeMonitorDetailsPathname(organization.slug, detectorId)},
        {label: t('Configure')},
      ]}
    />
  );
}

function DetectorDocumentTitle() {
  const title = useMetricDetectorFormField('name');
  return <SentryDocumentTitle title={t('Edit Monitor: %s', title)} />;
}

export default function DetectorEdit() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const params = useParams<{detectorId: string}>();

  useWorkflowEngineFeatureGate({redirect: true});

  const {
    data: detector,
    isPending,
    isError,
    refetch,
  } = useDetectorQuery(params.detectorId);

  const {mutateAsync: updateDetector} = useUpdateDetector();

  const handleSubmit = useCallback<OnSubmitCallback>(
    async (data, _, __, ___, formModel) => {
      if (!detector) {
        return;
      }

      const isValid = formModel.validateForm();
      if (!isValid) {
        return;
      }

      const updatedData = {
        detectorId: detector.id,
        ...getNewMetricDetectorData(data as MetricDetectorFormData),
      };

      const updatedDetector = await updateDetector(updatedData);
      navigate(makeMonitorDetailsPathname(organization.slug, updatedDetector.id));
    },
    [updateDetector, navigate, organization.slug, detector]
  );

  const initialData = useMemo((): MetricDetectorFormData | null => {
    if (!detector) {
      return null;
    }

    return getMetricDetectorFormData(detector);
  }, [detector]);

  if (isPending && !initialData) {
    return <LoadingIndicator />;
  }

  if (isError || !detector || !initialData) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <FullHeightForm hideFooter initialData={initialData} onSubmit={handleSubmit}>
      <DetectorDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <DetectorBreadcrumbs detectorId={params.detectorId} />
            <DetectorBaseFields />
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <MetricDetectorForm />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <Flex gap={space(1)} flex={1} justify="flex-end">
          <LinkButton
            priority="default"
            to={makeMonitorDetailsPathname(organization.slug, params.detectorId)}
          >
            {t('Cancel')}
          </LinkButton>
          <Button priority="primary" type="submit">
            {t('Save Changes')}
          </Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
