import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import moment from 'moment';

import {Alert} from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {DateString, Member, Organization, Project} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {findIncompatibleRules} from 'sentry/views/alerts/rules/issue';
import {ALERT_DEFAULT_CHART_PERIOD} from 'sentry/views/alerts/rules/metric/details/constants';

import AlertChart from './alertChart';
import AlertRuleIssuesList from './issuesList';
import Sidebar from './sidebar';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string; ruleId: string}, {}>;

type State = AsyncComponent['state'] & {
  memberList: Member[];
  rule: IssueAlertRule | null;
};

const PAGE_QUERY_PARAMS = [
  'pageStatsPeriod',
  'pageStart',
  'pageEnd',
  'pageUtc',
  'cursor',
];

class AlertRuleDetails extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  componentDidMount() {
    const {organization, params} = this.props;
    trackAdvancedAnalyticsEvent('issue_alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(params.ruleId, 10),
    });
  }

  componentDidUpdate(prevProps: Props) {
    const {organization: prevOrg, params: prevParams} = prevProps;
    const {organization: currOrg, params: currParams} = this.props;

    if (
      prevParams.ruleId !== currParams.ruleId ||
      prevOrg.slug !== currOrg.slug ||
      prevParams.projectId !== currParams.projectId
    ) {
      this.reloadData();
    }
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      rule: null,
      memberList: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {ruleId, projectId} = this.props.params;
    return [
      [
        'rule',
        `/projects/${organization.slug}/${projectId}/rules/${ruleId}/`,
        {query: {expand: 'lastTriggered'}},
        {allowError: error => error.status === 404},
      ],
      [
        'memberList',
        `/organizations/${organization.slug}/users/`,
        {query: {projectSlug: projectId}},
      ],
    ];
  }

  getDataDatetime(): DateTimeObject {
    const query = this.props.location?.query ?? {};

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

  setStateOnUrl(nextState: {
    cursor?: string;
    pageEnd?: DateString;
    pageStart?: DateString;
    pageStatsPeriod?: string | null;
    pageUtc?: boolean | null;
    team?: string;
  }) {
    return this.props.router.push({
      ...this.props.location,
      query: {
        ...this.props.location.query,
        ...pick(nextState, PAGE_QUERY_PARAMS),
      },
    });
  }

  handleUpdateDatetime = (datetime: ChangeData) => {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      return this.setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc ?? undefined,
        cursor: undefined,
      });
    }

    return this.setStateOnUrl({
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
      cursor: undefined,
    });
  };

  renderLoading() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <LoadingIndicator />
        </Layout.Main>
      </Layout.Body>
    );
  }

  renderIncompatibleAlert() {
    const {organization} = this.props;
    const {projectId, ruleId} = this.props.params;

    const incompatibleRule = findIncompatibleRules(this.state.rule);
    if (
      (incompatibleRule.conditionIndices || incompatibleRule.filterIndices) &&
      this.props.organization.features.includes('issue-alert-incompatible-rules')
    ) {
      return (
        <Alert type="error" showIcon>
          {tct(
            'The conditions in this alert rule conflict and might not be working properly. [link:Edit alert rule]',
            {
              link: (
                <a
                  href={`/organizations/${organization.slug}/alerts/rules/${projectId}/${ruleId}/`}
                />
              ),
            }
          )}
        </Alert>
      );
    }
    return null;
  }

  renderBody() {
    const {params, location, organization, project} = this.props;
    const {ruleId, projectId} = params;
    const {cursor} = location.query;
    const {period, start, end, utc} = this.getDataDatetime();
    const {rule, memberList} = this.state;

    if (!rule) {
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

    const duplicateLink = {
      pathname: `/organizations/${organization.slug}/alerts/new/issue/`,
      query: {
        project: project.slug,
        duplicateRuleId: rule.id,
        createFromDuplicate: true,
        referrer: 'issue_rule_details',
      },
    };

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
          projectSlug={projectId}
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
              <Button size="sm" icon={<IconCopy />} to={duplicateLink}>
                {t('Duplicate')}
              </Button>
              <Button
                size="sm"
                icon={<IconEdit />}
                to={`/organizations/${organization.slug}/alerts/rules/${projectId}/${ruleId}/`}
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
            {this.renderIncompatibleAlert()}
            <StyledPageTimeRangeSelector
              organization={organization}
              relative={period ?? ''}
              start={start ?? null}
              end={end ?? null}
              utc={utc ?? null}
              onUpdate={this.handleUpdateDatetime}
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
            <Sidebar rule={rule} memberList={memberList} teams={project.teams} />
          </Layout.Side>
        </Layout.Body>
      </PageFiltersContainer>
    );
  }
}

export default AlertRuleDetails;

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  margin-bottom: ${space(2)};
`;

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;
