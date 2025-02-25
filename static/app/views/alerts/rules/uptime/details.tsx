import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {updateUptimeRule} from 'sentry/actionCreators/uptime';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {
  CheckStatus,
  type CheckStatusBucket,
  type UptimeRule,
} from 'sentry/views/alerts/rules/uptime/types';

import {UptimeDetailsSidebar} from './detailsSidebar';
import {DetailsTimeline} from './detailsTimeline';
import {StatusToggleButton} from './statusToggleButton';
import {UptimeChecksTable} from './uptimeChecksTable';
import {UptimeIssues} from './uptimeIssues';

interface UptimeAlertDetailsProps
  extends RouteComponentProps<{projectId: string; uptimeRuleId: string}> {}

export default function UptimeAlertDetails({params}: UptimeAlertDetailsProps) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {projectId, uptimeRuleId} = params;

  const {projects, fetching: loadingProject} = useProjects({slugs: [projectId]});
  const project = projects.find(({slug}) => slug === projectId);

  const queryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${projectId}/uptime/${uptimeRuleId}/`,
  ];
  const {
    data: uptimeRule,
    isPending,
    isError,
  } = useApiQuery<UptimeRule>(queryKey, {staleTime: 0});

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
        <Layout.Main fullWidth>
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

  const handleUpdate = async (data: Partial<UptimeRule>) => {
    const resp = await updateUptimeRule(api, organization.slug, uptimeRule, data);

    if (resp !== null) {
      setApiQueryData(queryClient, queryKey, resp);
    }
  };

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${uptimeRule.name} — Alerts`} />
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
            {uptimeRule.name}
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <StatusToggleButton
              uptimeRule={uptimeRule}
              onToggleStatus={status => handleUpdate({status})}
              size="sm"
            />
            <LinkButton
              size="sm"
              icon={<IconEdit />}
              to={makeAlertsPathname({
                path: `/uptime-rules/${project.slug}/${uptimeRuleId}/`,
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
          {uptimeRule.status === 'disabled' && (
            <Alert.Container>
              <Alert
                type="muted"
                showIcon
                trailingItems={
                  <StatusToggleButton
                    uptimeRule={uptimeRule}
                    size="xs"
                    onToggleStatus={status => handleUpdate({status})}
                  >
                    {t('Enable')}
                  </StatusToggleButton>
                }
              >
                {t('This monitor is disabled and not recording uptime checks.')}
              </Alert>
            </Alert.Container>
          )}
          <DetailsTimeline uptimeRule={uptimeRule} onStatsLoaded={checkHasUnknown} />
          <UptimeIssues project={project} ruleId={uptimeRuleId} />
          <UptimeChecksTable uptimeRule={uptimeRule} />
        </Layout.Main>
        <Layout.Side>
          <UptimeDetailsSidebar
            uptimeRule={uptimeRule}
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
