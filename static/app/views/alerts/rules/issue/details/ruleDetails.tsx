import {useEffect} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import moment from 'moment';

import {Alert} from 'sentry/components/alert';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {DateTimeObject} from 'sentry/components/charts/utils';
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
import type {DateString, Project} from 'sentry/types';
import type {IssueAlertRule} from 'sentry/types/alerts';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {findIncompatibleRules} from 'sentry/views/alerts/rules/issue';
import {ALERT_DEFAULT_CHART_PERIOD} from 'sentry/views/alerts/rules/metric/details/constants';

import AlertChart from './alertChart';
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

function AlertRuleDetails({params, location, router}: AlertRuleDetailsProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {projectId: projectSlug, ruleId} = params;
  const {cursor} = location.query;
  const project: Project | undefined = projects.find(({slug}) => slug === projectSlug);

  const {
    data: rule,
    isLoading: isRuleLoading,
    isError: ruleLoadingError,
  } = useApiQuery<IssueAlertRule>(
    [
      `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/`,
      {query: {expand: 'lastTriggered'}},
    ],
    {
      staleTime: 0,
    }
  );

  useEffect(() => {
    trackAdvancedAnalyticsEvent('issue_alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(ruleId, 10),
    });
  }, [ruleId, organization]);

  function getDataDatetime(): DateTimeObject {
    const {
      start,
      end,
      statsPeriod,
      utc: utcString,
    } = normalizeDateTimeParams(location?.query ?? {}, {
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

  if (ruleLoadingError) {
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

  if (isRuleLoading) {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <LoadingIndicator />
        </Layout.Main>
      </Layout.Body>
    );
  }

  const {start, end, period, utc} = getDataDatetime();
  const incompatibleRule = findIncompatibleRules(rule);

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
            <Button
              size="sm"
              icon={<IconCopy />}
              to={{
                pathname: `/organizations/${organization.slug}/alerts/new/issue/`,
                query: {
                  project: project.slug,
                  duplicateRuleId: rule.id,
                  createFromDuplicate: true,
                  referrer: 'issue_rule_details',
                },
              }}
            >
              {t('Duplicate')}
            </Button>
            <Button
              size="sm"
              icon={<IconEdit />}
              to={`/organizations/${organization.slug}/alerts/rules/${projectSlug}/${ruleId}/`}
              onClick={() =>
                trackAdvancedAnalyticsEvent('issue_alert_rule_details.edit_clicked', {
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
          {(incompatibleRule.conditionIndices || incompatibleRule.filterIndices) &&
            organization.features.includes('issue-alert-incompatible-rules') && (
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
            )}
          <StyledPageTimeRangeSelector
            organization={organization}
            relative={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
            onUpdate={handleUpdateDatetime}
          />
          <AlertChart
            organization={organization}
            project={project}
            rule={rule}
            period={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
          />
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
          <Sidebar rule={rule} projectSlug={projectSlug} teams={project?.teams ?? []} />
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
