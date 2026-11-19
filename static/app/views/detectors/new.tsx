import {useTheme} from '@emotion/react';
import {parseAsString, useQueryState} from 'nuqs';

import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
import {t, tct} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

import {DetectorTypeForm, useDetectorTypeQueryState} from './components/detectorTypeForm';
import {MonitorFeedbackButton} from './components/monitorFeedbackButton';
import {getNoPermissionToCreateMonitorsTooltip} from './utils/monitorAccessMessages';
import {useCanCreateDetector} from './utils/useCanCreateDetector';
import {makeMonitorBasePathname} from './pathnames';

function NewDetectorBreadcrumbs() {
  const organization = useOrganization();

  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={{type: 'page-title', label: t('New Monitor')}}
      items={[
        {
          type: 'link',
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
      ]}
    />
  );
}

export default function DetectorNew() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const [detectorType] = useDetectorTypeQueryState();
  const [projectId] = useQueryState('project', parseAsString);
  const canCreateDetector = useCanCreateDetector(detectorType);

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
          <NewDetectorBreadcrumbs />
          <Text as="p" size="md" variant="muted">
            {tct(
              'Monitors detect problems in your application and create Sentry Issues. [docsLink:Read the Docs].',
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
        <LinkButton variant="secondary" to={makeMonitorBasePathname(organization.slug)}>
          {t('Cancel')}
        </LinkButton>
        <Button
          variant="primary"
          type="submit"
          disabled={!canCreateDetector}
          tooltipProps={{
            title: canCreateDetector
              ? undefined
              : getNoPermissionToCreateMonitorsTooltip(),
          }}
        >
          {t('Next')}
        </Button>
      </EditLayoutDeprecated.Footer>
    </EditLayoutDeprecated>
  );
}
