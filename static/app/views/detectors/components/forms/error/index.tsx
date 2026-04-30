import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {ErrorDetector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {EditDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {useSubmitEditDetector} from 'sentry/views/detectors/hooks/useSubmitEditDetector';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {getNoPermissionToEditMonitorTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

function StaticSections({project}: {project: Project}) {
  const organization = useOrganization();
  return (
    <Fragment>
      <Container>
        <FormSection step={1} title={t('Detect')}>
          <Text as="p">
            {tct(
              'An error issue will be created when a new issue group is detected. [link:Manage Grouping Rules]',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/issue-grouping/`}
                  />
                ),
              }
            )}
          </Text>
        </FormSection>
      </Container>
      <Container>
        <FormSection step={2} title={t('Assign')}>
          <Text as="p">
            {tct(
              'Sentry will attempt to automatically assign new issues based on [link:Ownership Rules].',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
                  />
                ),
              }
            )}
          </Text>
        </FormSection>
      </Container>
      <Container>
        <FormSection step={3} title={t('Prioritize')}>
          <Text as="p">
            {tct(
              'New error issues are prioritized based on log level. [link:Learn more about Issue Priority]',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/issues/issue-priority/" />
                ),
              }
            )}
          </Text>
        </FormSection>
      </Container>
      <Container>
        <FormSection step={4} title={t('Resolve')}>
          <Text as="p">
            {tct(
              'Issues may be automatically resolved based on [link:Auto Resolve Settings].',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/#resolveAge`}
                  />
                ),
              }
            )}
          </Text>
        </FormSection>
      </Container>
    </Fragment>
  );
}

export function NewErrorDetectorForm() {
  return (
    <Stack flex={1}>
      <Layout.Body>
        <Layout.Main width="full">
          <LoadingError message={t('Error detectors cannot be created')} />
        </Layout.Main>
      </Layout.Body>
    </Stack>
  );
}

export function EditExistingErrorDetectorForm({
  detector,
  project,
}: {
  detector: ErrorDetector;
  project: Project;
}) {
  const organization = useOrganization();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const hasPageFrameFeature = useHasPageFrameFeature();
  const submitEditDetector = useSubmitEditDetector();

  const canEditWorkflowConnections = useCanEditDetectorWorkflowConnections({
    projectId: detector.projectId,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {workflowIds: detector.workflowIds},
    validators: {
      onDynamic: z.object({
        workflowIds: z.array(z.string()),
      }),
    },
    onSubmit: async ({value}) => {
      await submitEditDetector({
        detectorId: detector.id,
        type: 'error' as const,
        name: detector.name,
        owner: detector.owner ? `${detector.owner.type}:${detector.owner.id}` : '',
        projectId: detector.projectId,
        workflowIds: value.workflowIds,
      });
    },
  });

  return (
    <EditLayout>
      <form.AppForm form={form}>
        {hasPageFrameFeature ? (
          <Fragment>
            <TopBar.Slot name="title">
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Monitors'),
                    to: makeMonitorBasePathname(organization.slug),
                  },
                  {
                    label: getDetectorTypeLabel(detector.type),
                    to: makeMonitorTypePathname(organization.slug, detector.type),
                  },
                  {
                    label: <ProjectBadge disableLink project={project} avatarSize={16} />,
                    to: makeMonitorDetailsPathname(organization.slug, detector.id),
                  },
                  {label: t('Configure')},
                ]}
              />
            </TopBar.Slot>
            <AutomationFeedbackButton />
          </Fragment>
        ) : (
          <EditLayout.Header>
            <EditLayout.HeaderContent>
              <Fragment>
                <EditDetectorBreadcrumbs detector={detector} />
                <EditLayout.Title title={detector.name} project={project} />
              </Fragment>
            </EditLayout.HeaderContent>
            <EditLayout.Actions>
              <AutomationFeedbackButton />
            </EditLayout.Actions>
          </EditLayout.Header>
        )}

        <EditLayout.Body>
          <Stack gap="2xl" maxWidth={maxWidth}>
            <StaticSections project={project} />
            <AutomateSection
              form={form}
              fields={{workflowIds: 'workflowIds'}}
              step={5}
              project={project}
            />
          </Stack>
        </EditLayout.Body>

        <EditLayout.Footer maxWidth={maxWidth}>
          <form.SubmitButton
            size="sm"
            disabled={!canEditWorkflowConnections}
            tooltipProps={{
              title: canEditWorkflowConnections
                ? undefined
                : getNoPermissionToEditMonitorTooltip(),
            }}
          >
            {t('Save')}
          </form.SubmitButton>
        </EditLayout.Footer>
      </form.AppForm>
    </EditLayout>
  );
}
