import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {updateUptimeRule} from 'sentry/actionCreators/uptime';
import {Alert} from 'sentry/components/alert';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import IdBadge from 'sentry/components/idBadge';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Text from 'sentry/components/text';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import getDuration from 'sentry/utils/duration/getDuration';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {
  CheckStatus,
  type CheckStatusBucket,
  type UptimeRule,
} from 'sentry/views/alerts/rules/uptime/types';

import {DetailsTimeline} from './detailsTimeline';
import {StatusToggleButton} from './statusToggleButton';
import {UptimeChecksTable} from './uptimeChecksTable';
import {UptimeIssues} from './uptimeIssues';

interface UptimeAlertDetailsProps
  extends RouteComponentProps<{projectId: string; uptimeRuleId: string}, {}> {}

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
                to: `/organizations/${organization.slug}/alerts/rules/`,
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
              to={`/organizations/${organization.slug}/alerts/uptime-rules/${project.slug}/${uptimeRuleId}/`}
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
          )}
          <DetailsTimeline uptimeRule={uptimeRule} onStatsLoaded={checkHasUnknown} />
          <UptimeIssues project={project} ruleId={uptimeRuleId} />
          <UptimeChecksTable uptimeRule={uptimeRule} />
        </Layout.Main>
        <Layout.Side>
          <MonitorUrlContainer>
            <SectionHeading>{t('Checked URL')}</SectionHeading>
            <CodeSnippet
              hideCopyButton
            >{`${uptimeRule.method} ${uptimeRule.url}`}</CodeSnippet>
          </MonitorUrlContainer>
          <SectionHeading>{t('Legend')}</SectionHeading>
          <CheckLegend>
            <CheckLegendItem>
              <CheckIndicator status={CheckStatus.SUCCESS} />
              <LegendText>
                {t('Check succeeded')}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={tct(
                    "A check status is successful when it meets uptime's check criteria. [link:Learn more].",
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-criteria" />
                      ),
                    }
                  )}
                />
              </LegendText>
            </CheckLegendItem>
            <CheckLegendItem>
              <CheckIndicator status={CheckStatus.FAILURE} />
              <LegendText>
                {t('Check failed')}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={tct(
                    "A check status is failed when it does't meet uptime's check criteria. A downtime issue is created after three consecutive failures. [link:Learn more].",
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                      ),
                    }
                  )}
                />
              </LegendText>
            </CheckLegendItem>
            {showMissedLegend && (
              <CheckLegendItem>
                <CheckIndicator status={CheckStatus.MISSED_WINDOW} />
                <LegendText>
                  {t('Did not perform check')}
                  <QuestionTooltip
                    isHoverable
                    size="sm"
                    title={tct(
                      'A check status is unknown when Sentry is unable to execute an uptime check at the scheduled time. [link:Learn more].',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                        ),
                      }
                    )}
                  />
                </LegendText>
              </CheckLegendItem>
            )}
          </CheckLegend>
          <SectionHeading>{t('Configuration')}</SectionHeading>
          <KeyValueTable>
            <KeyValueTableRow
              keyName={t('Check Interval')}
              value={t('Every %s', getDuration(uptimeRule.intervalSeconds))}
            />
            <KeyValueTableRow
              keyName={t('Timeout')}
              value={t('After %s', getDuration(uptimeRule.timeoutMs / 1000, 2))}
            />
            <KeyValueTableRow keyName={t('Environment')} value={uptimeRule.environment} />
            <KeyValueTableRow
              keyName={t('Owner')}
              value={
                uptimeRule.owner ? (
                  <ActorAvatar actor={uptimeRule.owner} />
                ) : (
                  t('Unassigned')
                )
              }
            />
          </KeyValueTable>
        </Layout.Side>
      </Layout.Body>
    </Layout.Page>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const CheckLegend = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(2)};
  padding: 0;
  gap: ${space(1)};
`;

const CheckLegendItem = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  grid-column: 1 / -1;
`;

const LegendText = styled(Text)`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const MonitorUrlContainer = styled('div')`
  margin-bottom: ${space(2)};

  h4 {
    margin-top: 0;
  }
`;
