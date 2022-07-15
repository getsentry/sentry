import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Button from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {InlineContainer} from 'sentry/components/charts/styles';
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
import {
  vitalDetailRouteWithQuery,
  VitalState,
} from 'sentry/views/performance/vitalDetail/utils';
import {_VitalChart} from 'sentry/views/performance/vitalDetail/vitalChart';
import VitalPercents from 'sentry/views/performance/vitalDetail/vitalPercents';

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
import {
  GenericPerformanceFooter,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from '../types';
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

type VitalDetailWidgetProps = {
  Footer?: GenericPerformanceFooter<DataType>;
  isVitalDetailView?: boolean;
};

export function VitalWidget(props: PerformanceWidgetProps & VitalDetailWidgetProps) {
  const mepSetting = useMEPSettingContext();
  const {ContainerActions, eventView, organization, location} = props;
  const useEvents = organization.features.includes(
    'performance-frontend-use-events-endpoint'
  );
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const field = props.fields[0];
  const pageError = usePageError();
  const isVitalDetailView = props.chartDefinition.isVitalDetailView;

  const {fieldsList, vitalFields, sortField} = transformFieldsWithStops({
    field,
    fields: props.fields,
    vitalStops: props.chartDefinition.vitalStops,
  });

  const Queries = {
    list: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        enabled: () => !isVitalDetailView,
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
              queryExtras={getMEPQueryParams(mepSetting)}
              useEvents={useEvents}
            />
          );
        },
        transform: transformDiscoverToList,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.eventView, fieldsList, props.organization.slug, mepSetting.memoizationKey]
    ),
    chart: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        enabled: widgetData => {
          return isVitalDetailView || !!widgetData?.list?.data?.length;
        },
        fields: fieldsList,
        component: provided => {
          const _eventView = provided.eventView.clone();

          if (!isVitalDetailView) {
            _eventView.additionalConditions.setFilterValues('transaction', [
              provided.widgetData.list.data[selectedListIndex]?.transaction as string,
            ]);
          }

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
              queryExtras={getMEPQueryParams(mepSetting)}
            />
          );
        },
        transform: transformEventsRequestToVitals,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.chartSetting, selectedListIndex, mepSetting.memoizationKey]
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
          [settingToVital[props.chartSetting]]: getVitalDataForListItem(
            listItem,
            vital,
            !useEvents
          ),
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
        if (props.isVitalDetailView) {
          const vital = settingToVital[props.chartSetting];

          return (
            <VitalPercents
              vital={vital}
              percents={[
                {vitalState: VitalState.GOOD, percent: 1},
                {vitalState: VitalState.MEH, percent: 1},
                {vitalState: VitalState.POOR, percent: 1},
              ]}
            />
          );
        }

        const vital = settingToVital[props.chartSetting];
        const target = vitalDetailRouteWithQuery({
          orgSlug: organization.slug,
          query: eventView.generateQueryStringObject(),
          vitalName: vital,
          projectID: decodeList(location.query.project),
        });

        return (
          <Fragment>
            <Button
              onClick={handleViewAllClick}
              to={target}
              size="sm"
              data-test-id="view-all-button"
            >
              {t('View All')}
            </Button>
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
          enabled: () => !isVitalDetailView,
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
                    vital,
                    !useEvents
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
                    {!props.withStaticFilters && (
                      <ListClose
                        setSelectListIndex={setSelectListIndex}
                        onClick={() => excludeTransaction(listItem.transaction, props)}
                      />
                    )}
                  </Fragment>
                );
              })}
            />
          ),
          height: 124,
          noPadding: true,
        },
      ]}
      Footer={
        isVitalDetailView
          ? () => {
              enum DisplayModes {
                WORST_VITALS = 'Worst Vitals',
                DURATION_P75 = 'Duration P75',
              }

              function generateDisplayOptions() {
                return [
                  {value: DisplayModes.WORST_VITALS, label: t(DisplayModes.WORST_VITALS)},
                  {value: DisplayModes.DURATION_P75, label: t(DisplayModes.DURATION_P75)},
                ];
              }
              return (
                <InlineContainer data-test-id="display-toggle">
                  <OptionSelector
                    title={t('Display')}
                    selected={DisplayModes.WORST_VITALS}
                    options={generateDisplayOptions()}
                    onChange={() => {}}
                  />
                </InlineContainer>
              );
            }
          : null
      }
    />
  );
}

function getVitalDataForListItem(
  listItem: TableDataRow,
  vital: WebVital,
  useAggregateAlias: boolean = true
) {
  const vitalFields = getVitalFields(vital);
  const transformFieldName = (fieldName: string) =>
    useAggregateAlias ? getAggregateAlias(fieldName) : fieldName;
  const poorData: number =
    (listItem[transformFieldName(vitalFields.poorCountField)] as number) || 0;
  const mehData: number =
    (listItem[transformFieldName(vitalFields.mehCountField)] as number) || 0;
  const goodData: number =
    (listItem[transformFieldName(vitalFields.goodCountField)] as number) || 0;
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
