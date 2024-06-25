import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics/constants';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {CustomMetricsTable} from 'sentry/views/settings/projectMetrics/customMetricsTable';
import {MetricsExtractionRulesTable} from 'sentry/views/settings/projectMetrics/metricsExtractionRulesTable';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

function ProjectMetrics({project}: Props) {
  const organization = useOrganization();
  const hasExtractionRules = hasCustomMetricsExtractionRules(organization);
  const {activateSidebar} = useMetricsOnboardingSidebar();

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(t('Metrics'), project.slug, false)} />
      <SettingsPageHeader
        title={t('Metrics')}
        action={
          !hasExtractionRules && (
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
          )
        }
      />

      <TextBlock>
        {tct(
          `Metrics are numerical values that can track anything about your environment over time, from latency to error rates to user signups. To learn more about metrics, [link:read the docs].`,
          {
            link: <ExternalLink href={METRICS_DOCS_URL} />,
          }
        )}
      </TextBlock>

      <PermissionAlert project={project} />

      {hasExtractionRules && <MetricsExtractionRulesTable project={project} />}

      <CustomMetricsTable project={project} />
    </Fragment>
  );
}

export default ProjectMetrics;
