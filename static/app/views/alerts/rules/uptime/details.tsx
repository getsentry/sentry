import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {updateUptimeRule} from 'sentry/actionCreators/uptime';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import {Alert} from 'sentry/components/core/alert';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {
  makeDetectorDetailsQueryKey,
  useDetectorQuery,
} from 'sentry/views/detectors/hooks';
import {monitorName} from 'sentry/views/insights/uptime/utils/monitorName';
import {useUptimeMonitorSummaries} from 'sentry/views/insights/uptime/utils/useUptimeMonitorSummary';

import {UptimeDetailsSidebar} from './detailsSidebar';
import {DetailsTimeline} from './detailsTimeline';
import {StatusToggleButton} from './statusToggleButton';
import {CheckStatus, type CheckStatusBucket} from './types';
import {UptimeChecksTable} from './uptimeChecksTable';
import {UptimeIssues} from './uptimeIssues';

export default function UptimeAlertDetails() {
  const {detectorId, projectId} = useParams<{detectorId: string; projectId: string}>();

  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {projects, fetching: loadingProject} = useProjects({slugs: [projectId]});
  const project = projects.find(({slug}) => slug === projectId);

  const {
    data: detector,
    isPending,
    isError,
  } = useDetectorQuery<UptimeDetector>(detectorId);

  const {data: uptimeSummaries} = useUptimeMonitorSummaries({detectorIds: [detectorId]});
  const summary =
    uptimeSummaries === undefined ? undefined : (uptimeSummaries?.[detectorId] ?? null);

  // Only display the missed window legend when there are visible missed window
  // check-ins in the timeline
  const [showMissedLegend, setShowMissedLegend] = useState(false);

  const checkHasUnknown = useCallback((stats: CheckStatusBucket[]) => {
    const hasUnknown = stats.some(bucket =>
      Boolean(bucket[1][CheckStatus.MISSED_WINDOW])
    );
    setShowMissedLegend(hasUnknown);
  }, []);

  if (isError) {
    return (
      <LoadingError
        message={t('The uptime alert rule you were looking for was not found.')}
      />
    );
  }

  if (isPending || loadingProject) {
    return (
      <Layout.Body>
        <Layout.Main width="full">
          <LoadingIndicator />
        </Layout.Main>
      </Layout.Body>
    );
  }

  if (!project) {
    return (
      <LoadingError message={t('The project you were looking for was not found.')} />
    );
  }

  const toggleStatus = async ({enabled}: Partial<UptimeDetector>) => {
    // XXX(epurkhiser): We're not yet able to use the detector APIs to enable /
    // disable uptime monitors. The detector APIs are not yet connected to
    // billing or remote uptime subscription updates, so we need to continue
    // using the legacy uptime rule APIs.
    const resp = await updateUptimeRule(api, organization, project, detector, {
      status: enabled ? 'active' : 'disabled',
    });

    if (resp !== null) {
      setApiQueryData<UptimeDetector>(
        queryClient,
        makeDetectorDetailsQueryKey({orgSlug: organization.slug, detectorId}),
        prev => Object.assign({}, prev, {enabled})
      );
    }
  };

  const uptimeSub = detector.dataSources[0].queryObj;

  const canEdit = hasEveryAccess(['alerts:write'], {organization, project});
  const permissionTooltipText = tct(
    'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}/`} />}
  );

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${monitorName(detector)} — Alerts`} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Alerts'),
                to: makeAlertsPathname({
                  path: `/rules/`,
                  organization,
                }),
              },
              {
                label: t('Uptime Monitor'),
              },
            ]}
          />
          <Layout.Title>
            <IdBadge
              project={project}
              avatarSize={28}
              hideName
              avatarProps={{hasTooltip: true, tooltip: project.slug}}
            />
            {monitorName(detector)}
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar>
            <StatusToggleButton
              uptimeDetector={detector}
              onToggleStatus={data => toggleStatus(data)}
              size="sm"
              disabled={!canEdit}
              {...(canEdit ? {} : {title: permissionTooltipText})}
            />
            <LinkButton
              size="sm"
              icon={<IconEdit />}
              disabled={!canEdit}
              title={canEdit ? undefined : permissionTooltipText}
              to={makeAlertsPathname({
                path: `/uptime-rules/${project.slug}/${detectorId}/`,
                organization,
              })}
            >
              {t('Edit Rule')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          <StyledPageFilterBar condensed>
            <DatePageFilter />
          </StyledPageFilterBar>
          {!detector.enabled && (
            <Alert.Container>
              <Alert
                variant="muted"
                trailingItems={
                  <StatusToggleButton
                    uptimeDetector={detector}
                    size="xs"
                    onToggleStatus={data => toggleStatus(data)}
                  >
                    {t('Enable')}
                  </StatusToggleButton>
                }
              >
                {t('This monitor is disabled and not recording uptime checks.')}
              </Alert>
            </Alert.Container>
          )}
          <DetailsTimeline uptimeDetector={detector} onStatsLoaded={checkHasUnknown} />
          <UptimeIssues project={project} uptimeDetector={detector} />
          <SectionHeading>{t('Checks List')}</SectionHeading>
          <UptimeChecksTable
            detectorId={detector.id}
            projectSlug={project.slug}
            traceSampling={uptimeSub.traceSampling}
          />
        </Layout.Main>
        <Layout.Side>
          <UptimeDetailsSidebar
            summary={summary}
            uptimeDetector={detector}
            showMissedLegend={showMissedLegend}
          />
        </Layout.Side>
      </Layout.Body>
    </Layout.Page>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
