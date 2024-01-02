import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary, Project} from 'sentry/types';
import useRouter from 'sentry/utils/useRouter';
import {
  RELATED_ISSUES_BOOLEAN_QUERY_ERROR,
  RelatedIssuesNotAvailable,
} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';
import {makeDefaultCta} from 'sentry/views/alerts/rules/metric/metricRulePresets';
import {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {isSessionAggregate} from 'sentry/views/alerts/utils';

import {TimePeriodType} from './constants';

interface Props {
  organization: OrganizationSummary;
  projects: Project[];
  rule: MetricRule;
  timePeriod: TimePeriodType;
  query?: string;
}

function RelatedIssues({rule, organization, projects, query, timePeriod}: Props) {
  const router = useRouter();

  // Add environment to the query parameters to be picked up by GlobalSelectionLink
  // GlobalSelectionLink uses the current query parameters to build links to issue details
  useEffect(() => {
    const env = rule.environment ?? '';
    if (env !== (router.location.query.environment ?? '')) {
      router.replace({
        pathname: router.location.pathname,
        query: {...router.location.query, environment: env},
      });
    }
  }, [rule.environment, router]);

  function renderErrorMessage({detail}: {detail: string}, retry: () => void) {
    if (
      detail === RELATED_ISSUES_BOOLEAN_QUERY_ERROR &&
      !isSessionAggregate(rule.aggregate)
    ) {
      const {buttonText, to} = makeDefaultCta({
        orgSlug: organization.slug,
        projects,
        rule,
        query,
        timePeriod,
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
      <ControlsWrapper>
        <StyledSectionHeading>{t('Related Issues')}</StyledSectionHeading>
        <Button data-test-id="issues-open" size="xs" to={issueSearch}>
          {t('Open in Issues')}
        </Button>
      </ControlsWrapper>

      <TableWrapper>
        <GroupList
          orgSlug={organization.slug}
          endpointPath={path}
          queryParams={queryParams}
          query={`start=${start}&end=${end}&groupStatsPeriod=auto`}
          canSelectGroups={false}
          renderEmptyMessage={renderEmptyMessage}
          renderErrorMessage={renderErrorMessage}
          withChart
          withPagination={false}
          useFilteredStats
          customStatsPeriod={timePeriod}
          useTintRow={false}
          source="alerts-related-issues"
        />
      </TableWrapper>
    </Fragment>
  );
}

const StyledSectionHeading = styled(SectionHeading)`
  display: flex;
  align-items: center;
`;

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default RelatedIssues;
