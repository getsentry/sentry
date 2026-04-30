import {useTheme} from '@emotion/react';
import {parseAsString, useQueryState} from 'nuqs';

import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t, tct} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DetectorTypeForm,
  useDetectorTypeQueryState,
} from 'sentry/views/detectors/components/detectorTypeForm';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

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
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const hasPageFrame = useHasPageFrameFeature();
  const [detectorType] = useDetectorTypeQueryState();
  const [projectId] = useQueryState('project', parseAsString);

  const formProps = {
    onSubmit: () => {
      navigate({
        pathname: `${makeMonitorBasePathname(organization.slug)}new/settings/`,
        query: {
          detectorType,
          project: projectId ?? undefined,
        },
      });
    },
    initialData: {
      detectorType,
    },
  };

  return (
    <EditLayoutDeprecated formProps={formProps}>
      <SentryDocumentTitle title={t('New Monitor')} />
      <EditLayoutDeprecated.Header maxWidth={maxWidth}>
        <EditLayoutDeprecated.HeaderContent>
          {hasPageFrame ? (
            <TopBar.Slot name="title">
              <NewDetectorBreadcrumbs />
            </TopBar.Slot>
          ) : (
            <NewDetectorBreadcrumbs />
          )}
          {!hasPageFrame && (
            <EditLayoutDeprecated.Title title={t('Select monitor type')} />
          )}
          <Text as="p" size="md" variant="muted">
            {tct(
              'Monitors detect problems in your application and send alerts when they occur. [docsLink:Read the Docs].',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/product/new-monitors-and-alerts/monitors/" />
                ),
              }
            )}
          </Text>
        </EditLayoutDeprecated.HeaderContent>
        <div>
          <MonitorFeedbackButton />
        </div>
      </EditLayoutDeprecated.Header>

      <EditLayoutDeprecated.Body maxWidth={maxWidth}>
        <DetectorTypeForm />
      </EditLayoutDeprecated.Body>

      <EditLayoutDeprecated.Footer label={t('Step 1 of 2')} maxWidth={maxWidth}>
        <LinkButton priority="default" to={makeMonitorBasePathname(organization.slug)}>
          {t('Cancel')}
        </LinkButton>
        <Button priority="primary" type="submit">
          {t('Next')}
        </Button>
      </EditLayoutDeprecated.Footer>
    </EditLayoutDeprecated>
  );
}
