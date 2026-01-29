import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  RELATED_ISSUES_BOOLEAN_QUERY_ERROR,
  RelatedIssuesNotAvailable,
} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';
import {makeDefaultCta} from 'sentry/views/alerts/rules/metric/metricRulePresets';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {isSessionAggregate} from 'sentry/views/alerts/utils';
import {getTraceItemTypeForDatasetAndEventType} from 'sentry/views/alerts/wizard/utils';

import type {TimePeriodType} from './constants';

interface Props {
  organization: Organization;
  projects: Project[];
  rule: MetricRule;
  timePeriod: TimePeriodType;
  query?: string;
  skipHeader?: boolean;
}

export default function RelatedIssues({
  rule,
  organization,
  projects,
  query,
  timePeriod,
  skipHeader,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  // Add environment to the query parameters to be picked up by GlobalSelectionLink
  // GlobalSelectionLink uses the current query parameters to build links to issue details
  useEffect(() => {
    const env = rule.environment ?? '';
    if (env !== (location.query.environment ?? '')) {
      navigate(
        {
          pathname: location.pathname,
          query: {...location.query, environment: env},
        },
        {replace: true}
      );
    }
  }, [rule.environment, location, navigate]);

  function renderErrorMessage({detail}: {detail: string}, retry: () => void) {
    if (
      detail === RELATED_ISSUES_BOOLEAN_QUERY_ERROR &&
      !isSessionAggregate(rule.aggregate)
    ) {
      const {buttonText, to} = makeDefaultCta({
        organization,
        projects,
        rule,
        query,
        timePeriod,
        traceItemType: getTraceItemTypeForDatasetAndEventType(
          rule.dataset,
          rule.eventTypes
        ),
      });
      return <RelatedIssuesNotAvailable buttonTo={to} buttonText={buttonText} />;
    }

    return <LoadingError onRetry={retry} />;
  }

  function renderEmptyMessage() {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {t('No issues for this alert rule')}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  }

  const {start, end} = timePeriod;

  const path = `/organizations/${organization.slug}/issues/`;
  const queryParams = {
    start,
    end,
    groupStatsPeriod: 'auto',
    limit: 5,
    ...(rule.environment ? {environment: rule.environment} : {}),
    sort: rule.aggregate === 'count_unique(user)' ? 'user' : 'freq',
    query,
    project: projects.map(project => project.id),
  };
  const issueSearch = {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: queryParams,
  };

  return (
    <Fragment>
      {!skipHeader && (
        <Flex justify="between" align="center" marginBottom="md">
          <SectionHeading>{t('Related Issues')}</SectionHeading>
          <LinkButton data-test-id="issues-open" size="xs" to={issueSearch}>
            {t('Open in Issues')}
          </LinkButton>
        </Flex>
      )}

      <TableWrapper>
        <GroupList
          endpointPath={path}
          queryParams={queryParams}
          canSelectGroups={false}
          renderEmptyMessage={renderEmptyMessage}
          renderErrorMessage={renderErrorMessage}
          withChart
          withPagination={false}
          useFilteredStats
          customStatsPeriod={timePeriod}
          useTintRow={false}
          source="alerts-related-issues"
          numPlaceholderRows={queryParams.limit}
        />
      </TableWrapper>
    </Fragment>
  );
}

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;
