import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import {parseAsString, useQueryState} from 'nuqs';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
import {t, tct} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DetectorTypeForm,
  useDetectorTypeQueryState,
} from 'sentry/views/detectors/components/detectorTypeForm';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';
import {TopBar} from 'sentry/views/navigation/topBar';

function NewDetectorBreadcrumbs() {
  const organization = useOrganization();

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Monitors'),
              to: makeMonitorBasePathname(organization.slug),
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={{type: 'page-title', label: t('New Monitor')}} />
      </TopBar.Slot>
    </Fragment>
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
        query: {detectorType, project: projectId ?? undefined},
      });
    },
    initialData: {detectorType},
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
