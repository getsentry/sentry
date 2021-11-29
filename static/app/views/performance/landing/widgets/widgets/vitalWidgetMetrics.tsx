import {Fragment, FunctionComponent, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
// import {getInterval} from 'sentry/components/charts/utils';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
// import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
// import pick from 'lodash/pick';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
// import withApi from 'sentry/utils/withApi';
import {vitalDetailRouteWithQuery} from 'sentry/views/performance/vitalDetail/utils';
import {_VitalChart} from 'sentry/views/performance/vitalDetail/vitalChart';

import {excludeTransaction} from '../../utils';
import {VitalBar} from '../../vitalsCards';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformEventsRequestToVitals} from '../transforms/transformEventsToVitals';
import {
  transformMetricsToList,
  VitalsMetricsItem,
} from '../transforms/transformMetricsToList';
import {transformMetricsToSeries} from '../transforms/transformMetricsToSeries';
import {QueryDefinition, WidgetDataResult} from '../types';
// import {eventsRequestQueryProps} from '../utils';
import {ChartDefinition, PerformanceWidgetSetting} from '../widgetDefinitions';

const settingToVital: {[x: string]: WebVital} = {
  [PerformanceWidgetSetting.WORST_LCP_VITALS]: WebVital.LCP,
  [PerformanceWidgetSetting.WORST_FCP_VITALS]: WebVital.FCP,
  [PerformanceWidgetSetting.WORST_FID_VITALS]: WebVital.FID,
  [PerformanceWidgetSetting.WORST_CLS_VITALS]: WebVital.CLS,
};

type Props = {
  title: string;
  titleTooltip: string;
  fields: string[];
  chartColor?: string;

  eventView: EventView;
  location: Location;
  organization: Organization;
  chartSetting: PerformanceWidgetSetting;
  chartDefinition: ChartDefinition;

  ContainerActions: FunctionComponent<{isLoading: boolean}>;
};

type DataType = {
  list: WidgetDataResult & ReturnType<typeof transformMetricsToList>;
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToVitals>;
};

// function transformFieldsWithStops(props: {
//   field: string;
//   fields: string[];
//   vitalStops: ChartDefinition['vitalStops'];
// }) {
//   const {field, fields, vitalStops} = props;
//   const poorStop = vitalStops?.poor;
//   const mehStop = vitalStops?.meh;

//   if (!defined(poorStop) || !defined(mehStop)) {
//     return {
//       sortField: fields[0],
//       fieldsList: fields,
//     };
//   }

//   const poorCountField = `count_if(${field},greaterOrEquals,${poorStop})`;
//   const mehCountField = `equation|count_if(${field},greaterOrEquals,${mehStop}) - count_if(${field},greaterOrEquals,${poorStop})`;
//   const goodCountField = `equation|count_if(${field},greaterOrEquals,0) - count_if(${field},greaterOrEquals,${mehStop})`;

//   const otherRequiredFieldsForQuery = [
//     `count_if(${field},greaterOrEquals,${mehStop})`,
//     `count_if(${field},greaterOrEquals,0)`,
//   ];

//   const vitalFields = {
//     poorCountField,
//     mehCountField,
//     goodCountField,
//   };

//   const fieldsList = [
//     poorCountField,
//     ...otherRequiredFieldsForQuery,
//     mehCountField,
//     goodCountField,
//   ];

//   return {
//     sortField: poorCountField,
//     vitalFields,
//     fieldsList,
//   };
// }

export function VitalWidgetMetrics(props: Props) {
  const api = useApi();
  const {ContainerActions, eventView, organization, location} = props;
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const field = props.fields[0];
  const metricsField = `avg(${field})`;
  const vital = settingToVital[props.chartSetting];

  // const {fieldsList, vitalFields, sortField} = transformFieldsWithStops({
  //   field,
  //   fields: props.fields,
  //   vitalStops: props.chartDefinition.vitalStops,
  // });
  // console.log({
  //   field,
  //   fields: props.fields,
  //   vitalStops: props.chartDefinition.vitalStops,
  // });
  // console.log('===== converted vvv');
  // console.log({fieldsList, vitalFields, sortField});

  const Queries = {
    list: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        fields: metricsField,
        component: provided => {
          // const _eventView = provided.eventView.clone();

          // const fieldFromProps = fieldsList.map(propField => ({
          //   field: propField,
          // }));

          // _eventView.sorts = [{kind: 'desc', field: sortField}];

          // _eventView.fields = [
          //   {field: 'transaction'},
          //   {field: 'title'},
          //   {field: 'project.id'},
          //   ...fieldFromProps,
          // ];
          // const mutableSearch = new MutableSearch(_eventView.query);
          // _eventView.query = mutableSearch.formatString();
          // return (
          //   <DiscoverQuery
          //     {...provided}
          //     eventView={_eventView}
          //     location={props.location}
          //     limit={3}
          //     cursor="0:0:1"
          //     noPagination
          //   />
          // );
          return (
            <MetricsRequest
              api={api}
              organization={organization}
              // project={projects.map(({id}) => Number(id))}
              // environment={environment ? [environment] : undefined}
              statsPeriod="14d"
              // query={query} // TODO: query?
              // interval={TIME_WINDOW_TO_SESSION_INTERVAL[timeWindow]}
              field={[metricsField]} // TODO: project field?
              groupBy={['transaction', 'measurement_rating']}
              orderBy={metricsField}
              limit={3}
            >
              {provided.children}
            </MetricsRequest>
          );
        },
        transform: transformMetricsToList,
      }),
      [props.eventView, metricsField, props.organization.slug]
    ),
    chart: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields: metricsField,
        component: provided => {
          // const _eventView = provided.eventView.clone();

          // _eventView.additionalConditions.setFilterValues('transaction', [
          //   provided.widgetData.list.data[selectedListIndex].transaction as string,
          // ]);

          // return (
          //   <EventsRequest
          //     {...pick(provided, eventsRequestQueryProps)}
          //     limit={1}
          //     currentSeriesNames={[sortField]}
          //     includePrevious={false}
          //     partial={false}
          //     includeTransformedData
          //     query={_eventView.getQueryWithAdditionalConditions()}
          //     interval={getInterval(
          //       {
          //         start: provided.start,
          //         end: provided.end,
          //         period: provided.period,
          //       },
          //       'medium'
          //     )}
          //   />
          // );
          return (
            <MetricsRequest
              api={api}
              organization={organization}
              // project={projects.map(({id}) => Number(id))}
              // environment={environment ? [environment] : undefined}
              statsPeriod="14d"
              // query={query}
              // interval={TIME_WINDOW_TO_SESSION_INTERVAL[timeWindow]}
              field={[metricsField]}
              groupBy={['measurement_rating']}
              query={`transaction:'/orgId/issues'`}
            >
              {provided.children}
            </MetricsRequest>
          );
        },
        transform: transformMetricsToSeries,
      }),
      [props.chartSetting, selectedListIndex]
    ),
  };

  const handleViewAllClick = () => {
    // TODO(k-fish): Add analytics.
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={provided => {
        const listItem = provided.widgetData.list?.data[selectedListIndex];

        if (!listItem) {
          return <Subtitle> </Subtitle>;
        }

        const data = {
          [vital]: getVitalDataForListItem(listItem),
        };

        return (
          <Subtitle>
            <VitalBar
              isLoading={provided.widgetData.list?.isLoading}
              vital={vital}
              data={data}
              showBar={false}
              showDurationDetail={false}
              showDetail
            />
          </Subtitle>
        );
      }}
      EmptyComponent={WidgetEmptyStateWarning}
      HeaderActions={provided => {
        const target = vitalDetailRouteWithQuery({
          orgSlug: organization.slug,
          query: eventView.generateQueryStringObject(),
          vitalName: vital,
          projectID: decodeList(location.query.project),
        });

        return (
          <Fragment>
            <div>
              <Button
                onClick={handleViewAllClick}
                to={target}
                size="small"
                data-test-id="view-all-button"
              >
                {t('View All')}
              </Button>
            </div>
            <ContainerActions {...provided.widgetData.chart} />
          </Fragment>
        );
      }}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <_VitalChart
              {...provided.widgetData.chart}
              {...provided}
              field={field}
              vitalFields={{
                poorCountField: 'poor',
                mehCountField: 'meh',
                goodCountField: 'good',
              }}
              organization={organization}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              grid={{
                left: space(0),
                right: space(0),
                top: space(2),
                bottom: space(2),
              }}
            />
          ),
          height: 160,
        },
        {
          component: provided => {
            return (
              <SelectableList
                selectedIndex={selectedListIndex}
                setSelectedIndex={setSelectListIndex}
                items={provided.widgetData.list.data.map(listItem => () => {
                  const transaction = listItem.transaction as string;
                  const _eventView = eventView.clone();

                  const initialConditions = new MutableSearch(_eventView.query);
                  initialConditions.addFilterValues('transaction', [transaction]);
                  _eventView.query = initialConditions.formatString();

                  const target = vitalDetailRouteWithQuery({
                    orgSlug: organization.slug,
                    query: _eventView.generateQueryStringObject(),
                    vitalName: vital,
                    projectID: decodeList(location.query.project),
                  });

                  const data = {
                    [vital]: getVitalDataForListItem(listItem),
                  };

                  return (
                    <Fragment>
                      <GrowLink to={target}>
                        <Truncate value={transaction} maxLength={40} />
                      </GrowLink>
                      <VitalBarCell>
                        <VitalBar
                          isLoading={provided.widgetData.list?.isLoading}
                          vital={vital}
                          data={data}
                          showBar
                          showDurationDetail={false}
                          showDetail={false}
                          barHeight={20}
                          showTooltip
                        />
                      </VitalBarCell>
                      <ListClose
                        setSelectListIndex={setSelectListIndex}
                        onClick={() => excludeTransaction(listItem.transaction, props)}
                      />
                    </Fragment>
                  );
                })}
              />
            );
          },
          height: 200,
          noPadding: true,
        },
      ]}
    />
  );
}

function getVitalDataForListItem(listItem: VitalsMetricsItem) {
  // TODO: move reduce logic from transformMetricsToList here
  const vitalData: VitalData = {
    ...listItem.measurement_rating,
    p75: 0,
    total: Object.values(listItem.measurement_rating).reduce(
      (acc, item) => acc + item,
      0
    ),
  };

  return vitalData;
}

const VitalBarCell = styled(RightAlignedCell)`
  width: 120px;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  display: flex;
  align-items: center;
  justify-content: center;
`;
// const EventsRequest = withApi(_EventsRequest);
