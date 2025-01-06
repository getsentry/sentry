import styled from '@emotion/styled';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import type EventView from 'sentry/utils/discover/eventView';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import Chart from '../../charts/chart';
import {DoubleHeaderContainer} from '../../styles';

import {getFieldOrBackup} from './utils';

type Props = {
  eventView: EventView;
  field: string;
  organization: Organization;
  title: string;
  titleTooltip: string;
  usingBackupAxis: boolean;
  backupField?: string;
};

function DurationChart({
  organization,
  eventView,
  field,
  title,
  titleTooltip,
  backupField,
  usingBackupAxis,
}: Props) {
  const location = useLocation();
  const api = useApi();

  // construct request parameters for fetching chart data
  const globalSelection = eventView.getPageFilters();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : null;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : null;

  const {utc} = normalizeDateTimeParams(location.query);

  const _backupField = backupField ? [backupField] : [];

  const apiPayload = eventView.getEventsAPIPayload(location);

  return (
    <EventsRequest
      organization={organization}
      api={api}
      period={globalSelection.datetime.period}
      project={globalSelection.projects}
      environment={globalSelection.environments}
      team={apiPayload.team}
      start={start}
      end={end}
      interval={getInterval(
        {
          start,
          end,
          period: globalSelection.datetime.period,
        },
        'high'
      )}
      showLoading={false}
      query={apiPayload.query}
      includePrevious={false}
      yAxis={[field, ..._backupField]}
      partial
      hideError
      referrer="api.performance.homepage.duration-chart"
    >
      {({
        loading,
        reloading,
        errored,
        timeseriesData: singleAxisResults,
        results: multiAxisResults,
      }) => {
        const _field = usingBackupAxis ? getFieldOrBackup(field, backupField) : field;
        const results = singleAxisResults
          ? singleAxisResults
          : [multiAxisResults?.find(r => r.seriesName === _field)].filter(Boolean);
        const series = results
          ? results.map(({...rest}) => {
              return {
                ...rest,
                seriesName: _field,
              };
            })
          : [];
        if (errored) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return (
          <div>
            <DoubleHeaderContainer>
              <HeaderTitleLegend>
                {title}
                <QuestionTooltip position="top" size="sm" title={titleTooltip} />
              </HeaderTitleLegend>
            </DoubleHeaderContainer>
            {results && (
              <ChartContainer>
                <MaskContainer>
                  <TransparentLoadingMask visible={loading} />
                  {getDynamicText({
                    value: (
                      <Chart
                        height={250}
                        data={series}
                        loading={loading || reloading}
                        statsPeriod={globalSelection.datetime.period}
                        start={start}
                        end={end}
                        utc={utc === 'true'}
                        grid={{
                          left: space(3),
                          right: space(3),
                          top: space(3),
                          bottom: loading || reloading ? space(4) : space(1.5),
                        }}
                        disableMultiAxis
                      />
                    ),
                    fixed: <Placeholder height="250px" testId="skeleton-ui" />,
                  })}
                </MaskContainer>
              </ChartContainer>
            )}
          </div>
        );
      }}
    </EventsRequest>
  );
}

const ChartContainer = styled('div')`
  padding-top: ${space(1)};
`;
const MaskContainer = styled('div')`
  position: relative;
`;

export default DurationChart;
