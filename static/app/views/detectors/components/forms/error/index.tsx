import {Link} from 'react-router-dom';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/core/button';
import {Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct} from 'sentry/locale';
import type {ErrorDetector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {EditDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';

type ErrorDetectorFormData = {
  workflowIds: string[];
};

function ErrorDetectorForm({detector}: {detector: ErrorDetector}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: detector.projectId});
  const theme = useTheme();

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.xl}>
      <Container>
        <Section title={t('Detect')}>
          <Text as="p">
            {tct(
              'An error issue will be created when a new issue group is detected. [link:Manage Grouping Rules]',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project?.slug}/issue-grouping/`}
                  />
                ),
              }
            )}
          </Text>
        </Section>
      </Container>
      <Container>
        <Section title={t('Assign')}>
          <Text as="p">
            {tct(
              'Sentry will attempt to automatically assign new issues based on [link:Ownership Rules].',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project?.slug}/ownership/`}
                  />
                ),
              }
            )}
          </Text>
        </Section>
      </Container>
      <Container>
        <Section title={t('Prioritize')}>
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
        </Section>
      </Container>
      <Container>
        <Section title={t('Prioritize')}>
          <Text as="p">
            {tct(
              'Issues may be automatically resolved based on [link:Auto Resolve Settings].',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project?.slug}/#resolveAge`}
                  />
                ),
              }
            )}
          </Text>
        </Section>
      </Container>
      <AutomateSection />
    </Stack>
  );
}

export function NewErrorDetectorForm() {
  return (
    <Layout.Page>
      <Layout.Body>
        <Layout.Main width="full">
          <LoadingError message={t('Error detectors cannot be created')} />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

export function EditExistingErrorDetectorForm({detector}: {detector: ErrorDetector}) {
  const project = useProjectFromId({project_id: detector.projectId});
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;

  const handleFormSubmit = useEditDetectorFormSubmit({
    detector,
    formDataToEndpointPayload: (data: ErrorDetectorFormData) => ({
      type: 'error',
      name: detector.name,
      owner: detector.owner ? `${detector.owner?.type}:${detector.owner?.id}` : '',
      projectId: detector.projectId,
      workflowIds: data.workflowIds,
      dataSources: [],
      conditionGroup: {},
    }),
  });

  return (
    <EditLayout
      formProps={{
        initialData: {
          workflowIds: detector.workflowIds,
        },
        onSubmit: handleFormSubmit,
      }}
    >
      <EditLayout.Header>
        <EditLayout.HeaderContent>
          <EditDetectorBreadcrumbs detector={detector} />
          <EditLayout.Title title={detector.name} project={project} />
        </EditLayout.HeaderContent>
        <EditLayout.Actions>
          <AutomationFeedbackButton />
        </EditLayout.Actions>
      </EditLayout.Header>

      <EditLayout.Body>
        <ErrorDetectorForm detector={detector} />
      </EditLayout.Body>

      <EditLayout.Footer maxWidth={maxWidth}>
        <Button type="submit" priority="primary" size="sm">
          {t('Save')}
        </Button>
      </EditLayout.Footer>
    </EditLayout>
  );
}
