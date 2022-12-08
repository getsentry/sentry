import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import BreakdownBars from 'sentry/components/charts/breakdownBars';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

function StatusBreakdown({eventView, location, organization}: Props) {
  const breakdownView = eventView
    .withColumns([
      {kind: 'function', function: ['count', '', '', undefined]},
      {kind: 'field', field: 'transaction.status'},
    ])
    .withSorts([{kind: 'desc', field: 'count'}]);

  return (
    <Fragment>
      <SectionHeading>
        {t('Status Breakdown')}
        <QuestionTooltip
          position="top"
          title={getTermHelp(organization, PERFORMANCE_TERM.STATUS_BREAKDOWN)}
          size="sm"
        />
      </SectionHeading>
      <DiscoverQuery
        eventView={breakdownView}
        location={location}
        orgSlug={organization.slug}
        referrer="api.performance.status-breakdown"
      >
        {({isLoading, error, tableData}) => {
          if (isLoading) {
            return <Placeholder height="124px" />;
          }
          if (error) {
            return (
              <ErrorPanel height="124px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }
          if (!tableData || tableData.data.length === 0) {
            return (
              <EmptyStatusBreakdown small>{t('No statuses found')}</EmptyStatusBreakdown>
            );
          }
          const points = tableData.data.map(row => ({
            label: String(row['transaction.status']),
            value: parseInt(String(row['count()']), 10),
            onClick: () => {
              const query = new MutableSearch(eventView.query);
              query
                .removeFilter('!transaction.status')
                .setFilterValues('transaction.status', [
                  row['transaction.status'] as string,
                ]);
              browserHistory.push({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  cursor: undefined,
                  query: query.formatString(),
                },
              });

              trackAdvancedAnalyticsEvent(
                'performance_views.transaction_summary.status_breakdown_click',
                {
                  organization,
                  status: row['transaction.status'] as string,
                }
              );
            },
          }));
          return <BreakdownBars data={points} />;
        }}
      </DiscoverQuery>
    </Fragment>
  );
}

const EmptyStatusBreakdown = styled(EmptyStateWarning)`
  height: 124px;
  padding: 50px 15%;
`;

export default StatusBreakdown;
