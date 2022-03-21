import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Button from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import DiscoverQuery, {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {getAggregateAlias, WebVital} from 'sentry/utils/discover/fields';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
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
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToVitals} from '../transforms/transformEventsToVitals';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps, getMEPQueryParams} from '../utils';
import {ChartDefinition, PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToVitals>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

function getVitalFields(baseField: string) {
  const poorCountField = `count_web_vitals(${baseField}, poor)`;
  const mehCountField = `count_web_vitals(${baseField}, meh)`;
  const goodCountField = `count_web_vitals(${baseField}, good)`;

  const vitalFields = {
    poorCountField,
    mehCountField,
    goodCountField,
  };
  return vitalFields;
}

export function transformFieldsWithStops(props: {
  field: string;
  fields: string[];
  vitalStops: ChartDefinition['vitalStops'];
}) {
  const {field, fields, vitalStops} = props;
  const poorStop = vitalStops?.poor;
  const mehStop = vitalStops?.meh;

  if (!defined(poorStop) || !defined(mehStop)) {
    return {
      sortField: fields[0],
      fieldsList: fields,
    };
  }

  const vitalFields = getVitalFields(field);

  const fieldsList = [
    vitalFields.poorCountField,
    vitalFields.mehCountField,
    vitalFields.goodCountField,
  ];

  return {
    sortField: vitalFields.poorCountField,
    vitalFields,
    fieldsList,
  };
}

export function VitalWidget(props: PerformanceWidgetProps) {
  const {isMEPEnabled} = useMEPSettingContext();
  const {ContainerActions, eventView, organization, location} = props;
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const field = props.fields[0];
  const pageError = usePageError();

  const {fieldsList, vitalFields, sortField} = transformFieldsWithStops({
    field,
    fields: props.fields,
    vitalStops: props.chartDefinition.vitalStops,
  });

  const Queries = {
    list: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        fields: sortField,
        component: provided => {
          const _eventView = provided.eventView.clone();

          const fieldFromProps = fieldsList.map(propField => ({
            field: propField,
          }));

          _eventView.sorts = [{kind: 'desc', field: sortField}];

          _eventView.fields = [
            {field: 'transaction'},
            {field: 'title'},
            {field: 'project.id'},
            ...fieldFromProps,
          ];
          const mutableSearch = new MutableSearch(_eventView.query);
          _eventView.query = mutableSearch.formatString();
          return (
            <DiscoverQuery
              {...provided}
              eventView={_eventView}
              location={props.location}
              limit={3}
              cursor="0:0:1"
              noPagination
              queryExtras={getMEPQueryParams(isMEPEnabled)}
            />
          );
        },
        transform: transformDiscoverToList,
      }),
      [props.eventView, fieldsList, props.organization.slug]
    ),
    chart: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields: fieldsList,
        component: provided => {
          const _eventView = provided.eventView.clone();

          _eventView.additionalConditions.setFilterValues('transaction', [
            provided.widgetData.list.data[selectedListIndex]?.transaction as string,
          ]);

          return (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              limit={1}
              currentSeriesNames={[sortField]}
              includePrevious={false}
              partial={false}
              includeTransformedData
              query={_eventView.getQueryWithAdditionalConditions()}
              interval={getInterval(
                {
                  start: provided.start,
                  end: provided.end,
                  period: provided.period,
                },
                'medium'
              )}
              hideError
              onError={pageError.setPageError}
              queryExtras={getMEPQueryParams(isMEPEnabled)}
            />
          );
        },
        transform: transformEventsRequestToVitals,
      }),
      [props.chartSetting, selectedListIndex]
    ),
  };

  const settingToVital: {[x: string]: WebVital} = {
    [PerformanceWidgetSetting.WORST_LCP_VITALS]: WebVital.LCP,
    [PerformanceWidgetSetting.WORST_FCP_VITALS]: WebVital.FCP,
    [PerformanceWidgetSetting.WORST_FID_VITALS]: WebVital.FID,
    [PerformanceWidgetSetting.WORST_CLS_VITALS]: WebVital.CLS,
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
          return <Subtitle />;
        }

        const vital = settingToVital[props.chartSetting];

        const data = {
          [settingToVital[props.chartSetting]]: getVitalDataForListItem(listItem, vital),
        };

        return (
          <Subtitle>
            <VitalBar
              isLoading={provided.widgetData.list?.isLoading}
              vital={settingToVital[props.chartSetting]}
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
        const vital = settingToVital[props.chartSetting];
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
              vitalFields={vitalFields}
              grid={provided.grid}
            />
          ),
          height: props.chartHeight,
        },
        {
          component: provided => (
            <SelectableList
              selectedIndex={selectedListIndex}
              setSelectedIndex={setSelectListIndex}
              items={provided.widgetData.list.data.map(listItem => () => {
                const transaction = listItem?.transaction as string;
                const _eventView = eventView.clone();

                const initialConditions = new MutableSearch(_eventView.query);
                initialConditions.addFilterValues('transaction', [transaction]);

                const vital = settingToVital[props.chartSetting];

                _eventView.query = initialConditions.formatString();

                const target = vitalDetailRouteWithQuery({
                  orgSlug: organization.slug,
                  query: _eventView.generateQueryStringObject(),
                  vitalName: vital,
                  projectID: decodeList(location.query.project),
                });

                const data = {
                  [settingToVital[props.chartSetting]]: getVitalDataForListItem(
                    listItem,
                    vital
                  ),
                };

                return (
                  <Fragment>
                    <GrowLink to={target}>
                      <Truncate value={transaction} maxLength={40} />
                    </GrowLink>
                    <VitalBarCell>
                      <VitalBar
                        isLoading={provided.widgetData.list?.isLoading}
                        vital={settingToVital[props.chartSetting]}
                        data={data}
                        showBar
                        showDurationDetail={false}
                        showDetail={false}
                        showTooltip
                        barHeight={20}
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
          ),
          height: 124,
          noPadding: true,
        },
      ]}
    />
  );
}

function getVitalDataForListItem(listItem: TableDataRow, vital: WebVital) {
  const vitalFields = getVitalFields(vital);

  const poorData: number =
    (listItem[getAggregateAlias(vitalFields.poorCountField)] as number) || 0;
  const mehData: number =
    (listItem[getAggregateAlias(vitalFields.mehCountField)] as number) || 0;
  const goodData: number =
    (listItem[getAggregateAlias(vitalFields.goodCountField)] as number) || 0;
  const _vitalData = {
    poor: poorData,
    meh: mehData,
    good: goodData,
    p75: 0,
  };
  const vitalData: VitalData = {
    ..._vitalData,
    total: _vitalData.poor + _vitalData.meh + _vitalData.good,
  };

  return vitalData;
}

export const VitalBarCell = styled(RightAlignedCell)`
  width: 120px;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  display: flex;
  align-items: center;
  justify-content: center;
`;
const EventsRequest = withApi(_EventsRequest);
