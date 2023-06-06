import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import moment from 'moment';

import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import SnoozeAlert from 'sentry/components/alerts/snoozeAlert';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCopy, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString} from 'sentry/types';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {RuleActionsCategories} from 'sentry/types/alerts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {findIncompatibleRules} from 'sentry/views/alerts/rules/issue';
import {ALERT_DEFAULT_CHART_PERIOD} from 'sentry/views/alerts/rules/metric/details/constants';

import {IssueAlertDetailsChart} from './alertChart';
import AlertRuleIssuesList from './issuesList';
import Sidebar from './sidebar';

interface AlertRuleDetailsProps
  extends RouteComponentProps<{projectId: string; ruleId: string}, {}> {}

const PAGE_QUERY_PARAMS = [
  'pageStatsPeriod',
  'pageStart',
  'pageEnd',
  'pageUtc',
  'cursor',
];

const getIssueAlertDetailsQueryKey = ({
  orgSlug,
  projectSlug,
  ruleId,
}: {
  orgSlug: string;
  projectSlug: string;
  ruleId: string;
}): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/rules/${ruleId}/`,
  {query: {expand: 'lastTriggered'}},
];

function getRuleActionCategory(rule: IssueAlertRule) {
  const numDefaultActions = rule.actions.filter(
    action => action.id === 'sentry.mail.actions.NotifyEmailAction'
  ).length;

  switch (numDefaultActions) {
    // Are all actions default actions?
    case rule.actions.length:
      return RuleActionsCategories.ALL_DEFAULT;
    // Are none of the actions default actions?
    case 0:
      return RuleActionsCategories.NO_DEFAULT;
    default:
      return RuleActionsCategories.SOME_DEFAULT;
  }
}

function AlertRuleDetails({params, location, router}: AlertRuleDetailsProps) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {projects, fetching: projectIsLoading} = useProjects();
  const project = projects.find(({slug}) => slug === params.projectId);
  const {projectId: projectSlug, ruleId} = params;
  const {
    data: rule,
    isLoading,
    isError,
  } = useApiQuery<IssueAlertRule>(
    getIssueAlertDetailsQueryKey({orgSlug: organization.slug, projectSlug, ruleId}),
    {staleTime: 0}
  );
  useRouteAnalyticsEventNames(
    'issue_alert_rule_details.viewed',
    'Issue Alert Rule Details: Viewed'
  );
  useRouteAnalyticsParams({rule_id: parseInt(params.ruleId, 10)});

  function getDataDatetime(): DateTimeObject {
    const query = location?.query ?? {};

    const {
      start,
      end,
      statsPeriod,
      utc: utcString,
    } = normalizeDateTimeParams(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true,
    });

    if (!statsPeriod && !start && !end) {
      return {period: ALERT_DEFAULT_CHART_PERIOD};
    }

    // Following getParams, statsPeriod will take priority over start/end
    if (statsPeriod) {
      return {period: statsPeriod};
    }

    const utc = utcString === 'true';
    if (start && end) {
      return utc
        ? {
            start: moment.utc(start).format(),
            end: moment.utc(end).format(),
            utc,
          }
        : {
            start: moment(start).utc().format(),
            end: moment(end).utc().format(),
            utc,
          };
    }

    return {period: ALERT_DEFAULT_CHART_PERIOD};
  }

  function setStateOnUrl(nextState: {
    cursor?: string;
    pageEnd?: DateString;
    pageStart?: DateString;
    pageStatsPeriod?: string | null;
    pageUtc?: boolean | null;
    team?: string;
  }) {
    return router.push({
      ...location,
      query: {
        ...location.query,
        ...pick(nextState, PAGE_QUERY_PARAMS),
      },
    });
  }

  function onSnooze({
    snooze,
    snoozeCreatedBy,
    snoozeForEveryone,
  }: {
    snooze: boolean;
    snoozeCreatedBy?: string;
    snoozeForEveryone?: boolean;
  }) {
    setApiQueryData<IssueAlertRule>(
      queryClient,
      getIssueAlertDetailsQueryKey({orgSlug: organization.slug, projectSlug, ruleId}),
      alertRule => ({...alertRule, snooze, snoozeCreatedBy, snoozeForEveryone})
    );
  }

  function handleUpdateDatetime(datetime: ChangeData) {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      return setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc ?? undefined,
        cursor: undefined,
      });
    }

    return setStateOnUrl({
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
      cursor: undefined,
    });
  }

  if (isLoading || projectIsLoading) {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <LoadingIndicator />
        </Layout.Main>
      </Layout.Body>
    );
  }

  if (!rule || isError) {
    return (
      <StyledLoadingError
        message={t('The alert rule you were looking for was not found.')}
      />
    );
  }

  if (!project) {
    return (
      <StyledLoadingError
        message={t('The project you were looking for was not found.')}
      />
    );
  }

  const hasSnoozeFeature = organization.features.includes('mute-alerts');
  const isSnoozed = rule.snooze;

  const ruleActionCategory = getRuleActionCategory(rule);

  const duplicateLink = {
    pathname: `/organizations/${organization.slug}/alerts/new/issue/`,
    query: {
      project: project.slug,
      duplicateRuleId: rule.id,
      createFromDuplicate: true,
      referrer: 'issue_rule_details',
    },
  };
  function renderIncompatibleAlert() {
    const incompatibleRule = findIncompatibleRules(rule);
    if (incompatibleRule.conditionIndices || incompatibleRule.filterIndices) {
      return (
        <Alert type="error" showIcon>
          {tct(
            'The conditions in this alert rule conflict and might not be working properly. [link:Edit alert rule]',
            {
              link: (
                <Link
                  to={`/organizations/${organization.slug}/alerts/rules/${projectSlug}/${ruleId}/`}
                />
              ),
            }
          )}
        </Alert>
      );
    }
    return null;
  }

  const {period, start, end, utc} = getDataDatetime();
  const {cursor} = location.query;
  return (
    <PageFiltersContainer
      skipInitializeUrlParams
      skipLoadLastUsed
      shouldForceProject
      forceProject={project}
    >
      <SentryDocumentTitle
        title={rule.name}
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      />

      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Alerts'),
                to: `/organizations/${organization.slug}/alerts/rules/`,
              },
              {
                label: rule.name,
                to: null,
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
            {rule.name}
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {hasSnoozeFeature && (
              <Access access={['alerts:write']}>
                {({hasAccess}) => (
                  <SnoozeAlert
                    isSnoozed={isSnoozed}
                    onSnooze={onSnooze}
                    ruleId={rule.id}
                    projectSlug={projectSlug}
                    ruleActionCategory={ruleActionCategory}
                    hasAccess={hasAccess}
                  />
                )}
              </Access>
            )}
            <Button size="sm" icon={<IconCopy />} to={duplicateLink}>
              {t('Duplicate')}
            </Button>
            <Button
              size="sm"
              icon={<IconEdit />}
              to={`/organizations/${organization.slug}/alerts/rules/${projectSlug}/${ruleId}/`}
              onClick={() =>
                trackAnalytics('issue_alert_rule_details.edit_clicked', {
                  organization,
                  rule_id: parseInt(ruleId, 10),
                })
              }
            >
              {t('Edit Rule')}
            </Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          {renderIncompatibleAlert()}
          {hasSnoozeFeature && isSnoozed && (
            <Alert showIcon>
              {ruleActionCategory === RuleActionsCategories.NO_DEFAULT
                ? tct(
                    "[creator] muted this alert so these notifications won't be sent in the future.",
                    {creator: rule.snoozeCreatedBy}
                  )
                : tct(
                    "[creator] muted this alert[forEveryone]so you won't get these notifications in the future.",
                    {
                      creator: rule.snoozeCreatedBy,
                      forEveryone: rule.snoozeForEveryone ? ' for everyone ' : ' ',
                    }
                  )}
            </Alert>
          )}
          <StyledPageTimeRangeSelector
            organization={organization}
            relative={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
            onUpdate={handleUpdateDatetime}
          />
          <ErrorBoundary>
            <IssueAlertDetailsChart
              project={project}
              rule={rule}
              period={period ?? ''}
              start={start ?? null}
              end={end ?? null}
              utc={utc ?? null}
            />
          </ErrorBoundary>
          <AlertRuleIssuesList
            organization={organization}
            project={project}
            rule={rule}
            period={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
            cursor={cursor}
          />
        </Layout.Main>
        <Layout.Side>
          <Sidebar rule={rule} projectSlug={project.slug} teams={project.teams} />
        </Layout.Side>
      </Layout.Body>
    </PageFiltersContainer>
  );
}

export default AlertRuleDetails;

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  margin-bottom: ${space(2)};
`;

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;
