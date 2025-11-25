import {useTheme} from '@emotion/react';
import {parseAsString, useQueryState} from 'nuqs';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  DetectorTypeForm,
  useDetectorTypeQueryState,
} from 'sentry/views/detectors/components/detectorTypeForm';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface NewDetectorFormData {
  detectorType: DetectorType;
  project: string;
}

function NewDetectorBreadcrumbs() {
  const organization = useOrganization();
  const newMonitorName = t('New Monitor');

  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {label: newMonitorName},
      ]}
    />
  );
}

export default function DetectorNew() {
  const navigate = useNavigate();
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const {projects} = useProjects();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const [detectorType] = useDetectorTypeQueryState();
  const [projectIdFromLocation] = useQueryState('project', parseAsString);
  const defaultProject = projects.find(p => p.isMember) ?? projects[0];

  const newMonitorName = t('New Monitor');

  const formProps = {
    onSubmit: (formData: any) => {
      // Form doesn't allow type to be defined, cast to the expected shape
      const data = formData as NewDetectorFormData;
      navigate({
        pathname: `${makeMonitorBasePathname(organization.slug)}new/settings/`,
        query: {
          detectorType,
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
        <LinkButton priority="default" to={makeMonitorBasePathname(organization.slug)}>
          {t('Cancel')}
        </LinkButton>
        <Button priority="primary" type="submit">
          {t('Next')}
        </Button>
      </EditLayout.Footer>
    </EditLayout>
  );
}
