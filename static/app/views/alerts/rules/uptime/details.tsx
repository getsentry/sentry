import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {updateUptimeRule} from 'sentry/actionCreators/uptime';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {
  setUptimeRuleData,
  useUptimeRule,
} from 'sentry/views/insights/uptime/utils/useUptimeRule';

import {UptimeDetailsSidebar} from './detailsSidebar';
import {DetailsTimeline} from './detailsTimeline';
import {StatusToggleButton} from './statusToggleButton';
import {CheckStatus, type CheckStatusBucket, type UptimeRule} from './types';
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

  const {
    data: uptimeRule,
    isPending,
    isError,
  } = useUptimeRule({projectSlug: projectId, uptimeRuleId});

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
      setUptimeRuleData({
        queryClient,
        organizationSlug: organization.slug,
        projectSlug: projectId,
        uptimeRule: resp,
      });
    }
  };

  const canEdit = hasEveryAccess(['alerts:write'], {organization, project});
  const permissionTooltipText = tct(
    'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}`} />}
  );

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
              disabled={!canEdit}
              title={!canEdit ? permissionTooltipText : undefined}
            />
            <LinkButton
              size="sm"
              icon={<IconEdit />}
              disabled={!canEdit}
              title={!canEdit ? permissionTooltipText : undefined}
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
