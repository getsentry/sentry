import {Fragment} from 'react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';
import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconFire} from 'sentry/icons/iconFire';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getFormattedDate} from 'sentry/utils/dates';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Detail from 'sentry/views/starfish/components/detailPanel';
import FailureDetailTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/failureDetailTable';
import FocusedFailureRateChart from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/focusedFailureRateChart';
import IssueTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/issueTable';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

export default function FailureDetailPanel({
  chartData,
  spike,
  onClose,
}: {
  chartData: Series[];
  onClose: () => void;
  spike: FailureSpike;
}) {
  const location = useLocation();
  const organization = useOrganization();

  if (isNil(spike)) {
    return null;
  }

  const hasStartAndEnd = spike?.startTimestamp && spike.endTimestamp;

  const newQuery: NewQuery = {
    name: t('Failure Sample'),
    projects: [],
    start: spike?.startTimestamp
      ? new Date(spike?.startTimestamp).toUTCString()
      : undefined,
    end: spike?.endTimestamp ? new Date(spike?.endTimestamp).toUTCString() : undefined,
    dataset: DiscoverDatasets.METRICS,
    range: !hasStartAndEnd
      ? decodeScalar(location.query.statsPeriod) || DEFAULT_STATS_PERIOD
      : undefined,
    fields: ['transaction', 'http_error_count()', 'http.method'],
    query:
      'event.type:transaction has:http.method transaction.op:http.server http_error_count():>0',
    version: 2,
  };
  newQuery.orderby = '-http_error_count';

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  return (
    <Detail detailKey={spike?.startTimestamp.toString()} onClose={onClose}>
      <Section>
        <IconFire color="errorText" size="lg" />
        <PanelTitle>{t('Web Service')}</PanelTitle>
      </Section>
      {spike && (
        <Fragment>
          <Section>
            <StatBlock>
              <SectionHeading>{t('Regression Metric')}</SectionHeading>
              <StatValue>{t('5xx Responses')}</StatValue>
            </StatBlock>
            <StatBlock>
              <SectionHeading>{t('Start Time')}</SectionHeading>
              <StatValue>
                {getFormattedDate(moment(spike.startTimestamp), 'MMM D, YYYY LT')}
              </StatValue>
            </StatBlock>
          </Section>
          <DiscoverQuery
            eventView={eventView}
            orgSlug={organization.slug}
            location={location}
            referrer="api.starfish.failure-event-list"
            limit={5}
          >
            {results => {
              const transactions = results?.tableData?.data.map(row => row.transaction);
              return (
                <Fragment>
                  <FocusedFailureRateChart data={chartData} spike={spike} />
                  <Title>{t('Failing Endpoints')}</Title>
                  <FailureDetailTable
                    {...results}
                    location={location}
                    organization={organization}
                    eventView={eventView}
                    spike={spike}
                  />

                  <Title>{t('Related Issues')}</Title>
                  <IssueTable
                    location={location}
                    organization={organization}
                    isLoading={results.isLoading}
                    spike={spike}
                    transactions={transactions as string[]}
                  />
                </Fragment>
              );
            }}
          </DiscoverQuery>
        </Fragment>
      )}
    </Detail>
  );
}

const PanelTitle = styled('h4')`
  margin-left: ${space(1)};
`;

const Title = styled('h5')`
  margin-bottom: ${space(1)};
`;

const Section = styled('div')`
  display: flex;
  flex-direction: row;
  margin-bottom: ${space(2)};
`;

const StatBlock = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: ${space(4)};
  margin-bottom: 0;
`;

const StatValue = styled('div')`
  font-weight: 400;
  font-size: 22px;
`;

const SectionHeading = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  margin: ${space(1)} 0 0 0;
`;
