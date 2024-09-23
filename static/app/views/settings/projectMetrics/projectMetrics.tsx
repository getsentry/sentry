import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics/constants';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import {MetricsBetaEndAlert} from 'sentry/views/metrics/metricsBetaEndAlert';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {CustomMetricsTable} from 'sentry/views/settings/projectMetrics/customMetricsTable';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

function ProjectMetrics({project}: Props) {
  const {activateSidebar} = useMetricsOnboardingSidebar();

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(t('Metrics'), project.slug, false)} />
      <SettingsPageHeader
        title={t('Metrics')}
        action={
          <Button
            priority="primary"
            onClick={() => {
              Sentry.metrics.increment('ddm.add_custom_metric', 1, {
                tags: {
                  referrer: 'settings',
                },
              });
              activateSidebar();
            }}
            size="sm"
          >
            {t('Add Metric')}
          </Button>
        }
      />

      <TextBlock>
        {tct(
          `Metrics are numerical values extracted from span attributes that can help you track anything about your environment over time. To learn more about metrics, [link:read the docs].`,
          {
            link: <ExternalLink href={METRICS_DOCS_URL} />,
          }
        )}
      </TextBlock>

      <MetricsBetaEndAlert />

      <PermissionAlert project={project} />

      <CustomMetricsTable project={project} />
    </Fragment>
  );
}

export default ProjectMetrics;
