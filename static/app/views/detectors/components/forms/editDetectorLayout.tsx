import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DETECTOR_FORM_CONFIG,
  type EditableDetectorType,
} from 'sentry/views/detectors/components/forms/config';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {EditDetectorActions} from 'sentry/views/detectors/components/forms/editDetectorActions';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

type EditDetectorLayoutProps = {
  children: React.ReactNode;
  detector: Detector;
  detectorType: EditableDetectorType;
  handleSubmit?: OnSubmitCallback;
  previewChart?: React.ReactNode;
};

function DetectorBreadcrumbs({detector}: {detector: Detector}) {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
        {
          label: detector.name,
          to: makeMonitorDetailsPathname(organization.slug, detector.id),
        },
        {label: t('Configure')},
      ]}
    />
  );
}

function DetectorDocumentTitle({detector}: {detector: Detector}) {
  return <SentryDocumentTitle title={t('Edit Monitor: %s', detector.name)} />;
}

export function EditDetectorLayout({
  previewChart,
  detector,
  children,
  detectorType,
  handleSubmit,
}: EditDetectorLayoutProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const config = DETECTOR_FORM_CONFIG[detectorType];
  const {mutateAsync: updateDetector} = useUpdateDetector();

  const handleFormSubmit = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, event, formModel) => {
      if (handleSubmit) {
        handleSubmit(data, onSubmitSuccess, onSubmitError, event, formModel);
        return;
      }

      const isValid = formModel.validateForm();
      if (!isValid) {
        return;
      }

      const formData = config.formDataToEndpointPayload(data as any);

      const updatedData = {
        detectorId: detector.id,
        ...formData,
      };

      const updatedDetector = await updateDetector(updatedData);
      navigate(makeMonitorDetailsPathname(organization.slug, updatedDetector.id));
    },
    [handleSubmit, config, detector.id, updateDetector, navigate, organization.slug]
  );

  const initialData = useMemo(() => {
    return config.savedDetectorToFormData(detector);
  }, [detector, config]);

  return (
    <FullHeightForm hideFooter initialData={initialData} onSubmit={handleFormSubmit}>
      <DetectorDocumentTitle detector={detector} />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <DetectorBreadcrumbs detector={detector} />
          </Layout.HeaderContent>
          <Flex>
            <EditDetectorActions detectorId={detector.id} />
          </Flex>
          <FullWidthContent>
            <DetectorBaseFields />
            {previewChart}
          </FullWidthContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>{children}</Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <Flex gap={space(1)} flex={1} justify="flex-end">
          <LinkButton
            priority="default"
            to={makeMonitorDetailsPathname(organization.slug, detector.id)}
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

const FullWidthContent = styled('div')`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
