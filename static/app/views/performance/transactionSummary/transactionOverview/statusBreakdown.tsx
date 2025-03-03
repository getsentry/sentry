import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import BreakdownBars from 'sentry/components/charts/breakdownBars';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useNavigate} from 'sentry/utils/useNavigate';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

function StatusBreakdown({eventView, location, organization}: Props) {
  const navigate = useNavigate();

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
          title={getTermHelp(organization, PerformanceTerm.STATUS_BREAKDOWN)}
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

              // Strip default filters, as we don't want them to show in the
              // search bar. See `generateEventView` in
              // static/app/views/performance/transactionSummary/transactionOverview/index.tsx.
              query.removeFilter('event.type').removeFilter('transaction');

              query
                .removeFilter('!transaction.status')
                .setFilterValues('transaction.status', [
                  row['transaction.status'] as string,
                ]);
              navigate({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  cursor: undefined,
                  query: query.formatString(),
                },
              });

              trackAnalytics(
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
