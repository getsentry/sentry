import * as ReactRouter from 'react-router';
import withRouter, {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import withApi from 'app/utils/withApi';

import Chart from '../../charts/chart';
import {DoubleHeaderContainer} from '../../styles';
import {getFieldOrBackup} from '../display/utils';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  field: string;
  title: string;
  titleTooltip: string;
  backupField?: string;
  usingBackupAxis: boolean;
} & WithRouterProps;

function DurationChart(props: Props) {
  const {
    organization,
    api,
    eventView,
    location,
    router,
    field,
    title,
    titleTooltip,
    backupField,
    usingBackupAxis,
  } = props;

  // construct request parameters for fetching chart data
  const globalSelection = eventView.getGlobalSelection();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : null;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : null;

  const {utc} = getParams(location.query);

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
                        router={router}
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

export default withRouter(withApi(DurationChart));
