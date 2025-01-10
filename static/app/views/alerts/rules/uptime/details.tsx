import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import IdBadge from 'sentry/components/idBadge';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import getDuration from 'sentry/utils/duration/getDuration';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

import {UptimeIssues} from './uptimeIssues';

interface UptimeAlertDetailsProps
  extends RouteComponentProps<{projectId: string; uptimeRuleId: string}, {}> {}

export default function UptimeAlertDetails({params}: UptimeAlertDetailsProps) {
  const organization = useOrganization();
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
            <EnvironmentPageFilter />
          </StyledPageFilterBar>
          <UptimeIssues project={project} ruleId={uptimeRuleId} />
        </Layout.Main>
        <Layout.Side>
          <SectionHeading>{t('Checked URL')}</SectionHeading>
          <CodeSnippet
            hideCopyButton
          >{`${uptimeRule.method} ${uptimeRule.url}`}</CodeSnippet>
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
