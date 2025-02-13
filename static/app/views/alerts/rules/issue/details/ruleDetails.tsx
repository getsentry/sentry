import styled from '@emotion/styled';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import SnoozeAlert from 'sentry/components/alerts/snoozeAlert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {RuleActionsCategories} from 'sentry/types/alerts';
import type {DateString} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {findIncompatibleRules} from 'sentry/views/alerts/rules/issue';
import {ALERT_DEFAULT_CHART_PERIOD} from 'sentry/views/alerts/rules/metric/details/constants';
import {getRuleActionCategory} from 'sentry/views/alerts/rules/utils';

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

function AlertRuleDetails({params, location, router}: AlertRuleDetailsProps) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const api = useApi();
  const {projects, fetching: projectIsLoading} = useProjects();
  const project = projects.find(({slug}) => slug === params.projectId);
  const {projectId: projectSlug, ruleId} = params;
  const {
    data: rule,
    isPending,
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

  async function handleKeepAlertAlive() {
    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/`,
        {
          method: 'PUT',
          data: {
            ...rule,
            optOutExplicit: true,
          },
        }
      );

      // Update alert rule to remove disableDate
      setApiQueryData<IssueAlertRule>(
        queryClient,
        getIssueAlertDetailsQueryKey({orgSlug: organization.slug, projectSlug, ruleId}),
        alertRule => ({...alertRule, disableDate: undefined})
      );

      addSuccessMessage(t('Successfully updated'));
    } catch (err) {
      addErrorMessage(t('Unable to update alert rule'));
    }
  }

  async function handleReEnable() {
    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/enable/`,
        {method: 'PUT'}
      );

      // Update alert rule to remove disableDate
      setApiQueryData<IssueAlertRule>(
        queryClient,
        getIssueAlertDetailsQueryKey({orgSlug: organization.slug, projectSlug, ruleId}),
        alertRule => ({...alertRule, disableDate: undefined, status: 'active'})
      );

      addSuccessMessage(t('Successfully re-enabled'));
    } catch (err) {
      addErrorMessage(
        typeof err.responseJSON?.detail === 'string'
          ? err.responseJSON.detail
          : t('Unable to update alert rule')
      );
    }
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

  if (isPending || projectIsLoading) {
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

  const isSnoozed = rule.snooze;

  const ruleActionCategory = getRuleActionCategory(rule);

  const duplicateLink = {
    pathname: makeAlertsPathname({
      path: `/new/issue/`,
      organization,
    }),
    query: {
      project: project.slug,
      duplicateRuleId: rule.id,
      createFromDuplicate: 'true',
      referrer: 'issue_rule_details',
    },
  };
  function renderIncompatibleAlert() {
    const incompatibleRule = findIncompatibleRules(rule);
    if (incompatibleRule.conditionIndices || incompatibleRule.filterIndices) {
      return (
        <Alert.Container>
          <Alert type="error" showIcon>
            {tct(
              'The conditions in this alert rule conflict and might not be working properly. [link:Edit alert rule]',
              {
                link: (
                  <Link
                    to={makeAlertsPathname({
                      path: `/rules/${projectSlug}/${ruleId}/`,
                      organization,
                    })}
                  />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }
    return null;
  }

  function renderDisabledAlertBanner() {
    // Rule has been disabled and has a disabled date indicating it was disabled due to lack of activity
    if (rule?.status === 'disabled' && moment(new Date()).isAfter(rule.disableDate)) {
      return (
        <Alert.Container>
          <Alert type="warning" showIcon>
            {tct(
              'This alert was disabled due to lack of activity. Please [keepAlive] to enable this alert.',
              {
                keepAlive: (
                  <BoldButton priority="link" size="sm" onClick={handleReEnable}>
                    {t('click here')}
                  </BoldButton>
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }

    // Generic rule disabled banner
    if (rule?.status === 'disabled') {
      return (
        <Alert.Container>
          <Alert type="warning" showIcon>
            {rule.actions?.length === 0
              ? t(
                  'This alert is disabled due to missing actions. Please edit the alert rule to enable this alert.'
                )
              : t(
                  'This alert is disabled due to its configuration and needs to be edited to be enabled.'
                )}
          </Alert>
        </Alert.Container>
      );
    }

    // Rule to be disabled soon
    if (rule?.disableDate && moment(rule.disableDate).isAfter(new Date())) {
      return (
        <Alert.Container>
          <Alert type="warning" showIcon>
            {tct(
              'This alert is scheduled to be disabled [date] due to lack of activity. Please [keepAlive] to keep this alert active. [docs:Learn more]',
              {
                date: <TimeSince date={rule.disableDate} />,
                keepAlive: (
                  <BoldButton priority="link" size="sm" onClick={handleKeepAlertAlive}>
                    {t('click here')}
                  </BoldButton>
                ),
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/alerts/#disabled-alerts" />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
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
                to: makeAlertsPathname({
                  path: `/rules/`,
                  organization,
                }),
              },
              {
                label: t('Issue Alert'),
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
            <Access access={['alerts:write']}>
              {({hasAccess}) => (
                <SnoozeAlert
                  isSnoozed={isSnoozed}
                  onSnooze={onSnooze}
                  ruleId={rule.id}
                  projectSlug={projectSlug}
                  ruleActionCategory={ruleActionCategory}
                  hasAccess={hasAccess}
                  type="issue"
                  disabled={rule.status === 'disabled'}
                />
              )}
            </Access>
            <LinkButton
              size="sm"
              icon={<IconCopy />}
              to={duplicateLink}
              disabled={rule.status === 'disabled'}
            >
              {t('Duplicate')}
            </LinkButton>
            <LinkButton
              size="sm"
              icon={<IconEdit />}
              to={makeAlertsPathname({
                path: `/rules/${projectSlug}/${ruleId}/`,
                organization,
              })}
              onClick={() =>
                trackAnalytics('issue_alert_rule_details.edit_clicked', {
                  organization,
                  rule_id: parseInt(ruleId, 10),
                })
              }
            >
              {rule.status === 'disabled' ? t('Edit to enable') : t('Edit Rule')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          {renderIncompatibleAlert()}
          {renderDisabledAlertBanner()}
          {isSnoozed && (
            <Alert.Container>
              <Alert type="info" showIcon>
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
            </Alert.Container>
          )}
          <StyledTimeRangeSelector
            relative={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
            onChange={handleUpdateDatetime}
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

const StyledTimeRangeSelector = styled(TimeRangeSelector)`
  margin-bottom: ${space(2)};
`;

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;

const BoldButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightBold};
`;
