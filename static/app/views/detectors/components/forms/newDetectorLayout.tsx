import {useCallback, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  DETECTOR_FORM_CONFIG,
  type DetectorFormData,
  type EditableDetectorType,
} from 'sentry/views/detectors/components/forms/config';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {DETECTOR_TYPE_LABELS} from 'sentry/views/detectors/constants';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

type NewDetectorLayoutProps = {
  children: React.ReactNode;
  detectorType: EditableDetectorType;
  handleSubmit?: OnSubmitCallback;
  initialFormData?: Partial<DetectorFormData>;
};

export function NewDetectorLayout({
  children,
  handleSubmit,
  initialFormData,
  detectorType,
}: NewDetectorLayoutProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const {mutateAsync: createDetector} = useCreateDetector();
  const config = DETECTOR_FORM_CONFIG[detectorType];

  const formSubmitHandler = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, event, formModel) => {
      if (handleSubmit) {
        handleSubmit(data, onSubmitSuccess, onSubmitError, event, formModel);
        return;
      }

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
    [config, createDetector, navigate, handleSubmit, organization.slug]
  );

  const initialData = useMemo(() => {
    if (initialFormData) {
      return initialFormData;
    }

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
    initialFormData,
    location.query.environment,
    location.query.name,
    location.query.owner,
    location.query.project,
    projects,
  ]);

  return (
    <FullHeightForm hideFooter initialData={initialData} onSubmit={formSubmitHandler}>
      <SentryDocumentTitle
        title={t('New %s Monitor', DETECTOR_TYPE_LABELS[detectorType])}
      />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {
                  label: t('New %s Monitor', DETECTOR_TYPE_LABELS[detectorType]),
                },
              ]}
            />
            <DetectorBaseFields />
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>{children}</Layout.Main>
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
