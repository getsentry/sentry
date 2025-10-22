import {useTheme} from '@emotion/react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Tooltip} from 'sentry/components/core/tooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {DetectorTypeForm} from 'sentry/views/detectors/components/detectorTypeForm';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface NewDetectorFormData {
  detectorType: DetectorType;
  project: string;
}

function NewDetectorBreadcrumbs() {
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();
  const newMonitorName = t('New Monitor');

  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug, monitorsLinkPrefix),
        },
        {label: newMonitorName},
      ]}
    />
  );
}

export default function DetectorNew() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();
  useWorkflowEngineFeatureGate({redirect: true});
  const location = useLocation();
  const {projects} = useProjects();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const detectorType = location.query.detectorType as DetectorType;

  const projectIdFromLocation =
    typeof location.query.project === 'string' ? location.query.project : undefined;
  const defaultProject = projects.find(p => p.isMember) ?? projects[0];

  const newMonitorName = t('New Monitor');

  const formProps = {
    onSubmit: (formData: any) => {
      // Form doesn't allow type to be defined, cast to the expected shape
      const data = formData as NewDetectorFormData;
      navigate({
        pathname: `${makeMonitorBasePathname(organization.slug, monitorsLinkPrefix)}new/settings/`,
        query: {
          detectorType: location.query.detectorType as DetectorType,
          project: data.project,
        },
      });
    },
    initialData: {
      detectorType,
      project: projectIdFromLocation ?? defaultProject?.id ?? '',
    } satisfies NewDetectorFormData,
  };

  return (
    <EditLayout formProps={formProps}>
      <SentryDocumentTitle title={newMonitorName} />

      <EditLayout.Header maxWidth={maxWidth}>
        <EditLayout.HeaderContent>
          <NewDetectorBreadcrumbs />
          <EditLayout.Title title={newMonitorName} />
        </EditLayout.HeaderContent>
        <div>
          <MonitorFeedbackButton />
        </div>
      </EditLayout.Header>

      <EditLayout.Body maxWidth={maxWidth}>
        <DetectorTypeForm />
      </EditLayout.Body>

      <EditLayout.Footer label={t('Step 1 of 2')} maxWidth={maxWidth}>
        <LinkButton
          priority="default"
          to={makeMonitorBasePathname(organization.slug, monitorsLinkPrefix)}
        >
          {t('Cancel')}
        </LinkButton>
        <Tooltip
          title={t('Select a monitor type to continue')}
          disabled={!!detectorType}
          skipWrapper
        >
          <Button priority="primary" type="submit" disabled={!detectorType}>
            {t('Next')}
          </Button>
        </Tooltip>
      </EditLayout.Footer>
    </EditLayout>
  );
}
