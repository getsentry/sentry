import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {LinkButton} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import type {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';
import {vitalDetailRouteWithQuery} from 'sentry/views/performance/vitalDetail/utils';
import {VitalChartInner} from 'sentry/views/performance/vitalDetail/vitalChart';

import {excludeTransaction} from '../../utils';
import {VitalBar} from '../../vitalsCards';
import {Accordion} from '../components/accordion';
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
import type {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  QueryDefinition,
  WidgetDataResult,
} from '../types';
import {
  eventsRequestQueryProps,
  getMEPQueryParams,
  QUERY_LIMIT_PARAM,
  TOTAL_EXPANDABLE_ROWS_HEIGHT,
} from '../utils';
import type {ChartDefinition} from '../widgetDefinitions';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToVitals>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

type ComponentData = React.ComponentProps<
  GenericPerformanceWidgetProps<DataType>['Visualizations'][0]['component']
>;

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
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const {ContainerActions, eventView, organization, InteractiveTitle} = props;
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const field = props.fields[0]!;
  const {setPageError} = usePageAlert();

  const {fieldsList, vitalFields, sortField} = transformFieldsWithStops({
    field,
    fields: props.fields,
    vitalStops: props.chartDefinition.vitalStops,
  });

  const Queries = {
    list: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        fields: sortField!,
        component: provided => {
          const _eventView = provided.eventView.clone();

          const fieldFromProps = fieldsList.map(propField => ({
            field: propField,
          }));

          _eventView.sorts = [{kind: 'desc', field: sortField!}];
          if (canUseMetricsData(organization)) {
            _eventView.additionalConditions.setFilterValues('!transaction', [
              UNPARAMETERIZED_TRANSACTION,
            ]);
          }

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
              location={location}
              limit={4}
              cursor="0:0:1"
              noPagination
              queryExtras={getMEPQueryParams(mepSetting)}
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
          return !!widgetData?.list?.data?.length;
        },
        fields: fieldsList,
        component: provided => {
          const _eventView = provided.eventView.clone();

          _eventView.additionalConditions.setFilterValues('transaction', [
            provided.widgetData.list.data[selectedListIndex]?.transaction as string,
          ]);

          let requestProps = pick(provided, eventsRequestQueryProps);
          const showOnlyPoorVitals = organization.features.includes(
            'performance-new-widget-designs'
          );
          if (showOnlyPoorVitals) {
            const yAxis = Array.isArray(requestProps.yAxis)
              ? requestProps.yAxis
              : [requestProps.yAxis];
            const poorVitalsAxis = yAxis.find(vitalField => vitalField?.includes('poor'));
            requestProps = {
              ...requestProps,
              yAxis: poorVitalsAxis ? [poorVitalsAxis] : requestProps.yAxis,
            };
          }
          return (
            <EventsRequest
              {...requestProps}
              limit={1}
              currentSeriesNames={[sortField!]}
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
              onError={setPageError}
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

  const assembleAccordionItems = (provided: ComponentData) =>
    getItems(provided).map(item => ({header: item, content: getChart(provided)}));

  const getChart = (provided: ComponentData) => (
    <VitalChartInner
      {...provided.widgetData.chart}
      {...provided}
      field={field}
      vitalFields={vitalFields}
      grid={provided.grid}
    />
  );

  const getItems = (provided: ComponentData) =>
    provided.widgetData.list.data.slice(0, QUERY_LIMIT_PARAM).map((listItem, i) => {
      const transaction = (listItem?.transaction as string | undefined) ?? '';
      const _eventView = eventView.clone();

      const initialConditions = new MutableSearch(_eventView.query);
      initialConditions.addFilterValues('transaction', [transaction]);

      const vital = settingToVital[props.chartSetting]!;

      _eventView.query = initialConditions.formatString();

      const isUnparameterizedRow = transaction === UNPARAMETERIZED_TRANSACTION;
      const transactionTarget = transactionSummaryRouteWithQuery({
        orgSlug: props.organization.slug,
        projectID: listItem['project.id'] as string,
        transaction: listItem.transaction as string,
        query: _eventView.generateQueryStringObject(),
        display: DisplayModes.VITALS,
      });

      const target = isUnparameterizedRow
        ? createUnnamedTransactionsDiscoverTarget({
            organization,
            location,
          })
        : transactionTarget;

      const data = {
        [settingToVital[props.chartSetting]!]: getVitalDataForListItem(
          listItem,
          vital,
          false
        ),
      };

      return (
        <Fragment key={i}>
          <GrowLink to={target}>
            <Truncate value={transaction} maxLength={40} />
          </GrowLink>
          <VitalBarCell>
            <VitalBar
              isLoading={provided.widgetData.list?.isLoading}
              vital={settingToVital[props.chartSetting]!}
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
              onClick={() =>
                excludeTransaction(listItem.transaction!, {
                  eventView: props.eventView,
                  location,
                })
              }
            />
          )}
        </Fragment>
      );
    });

  const visualizations: GenericPerformanceWidgetProps<DataType>['Visualizations'] =
    organization.features.includes('performance-new-widget-designs')
      ? [
          {
            component: provided => (
              <Accordion
                expandedIndex={selectedListIndex}
                setExpandedIndex={setSelectListIndex}
                items={assembleAccordionItems(provided)}
              />
            ),
            // accordion items height + chart height
            height: TOTAL_EXPANDABLE_ROWS_HEIGHT + props.chartHeight,
            noPadding: true,
          },
        ]
      : [
          {
            component: provided => (
              <VitalChartInner
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
                items={getItems(provided)}
              />
            ),
            height: 30,
            noPadding: true,
          },
        ];

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
      location={location}
      Subtitle={provided => {
        const listItem = provided.widgetData.list?.data[selectedListIndex];

        if (!listItem) {
          return <Subtitle />;
        }

        const vital = settingToVital[props.chartSetting]!;

        const data = {
          [settingToVital[props.chartSetting]!]: getVitalDataForListItem(
            listItem,
            vital,
            false
          ),
        };

        return (
          <Subtitle>
            <VitalBar
              isLoading={provided.widgetData.list?.isLoading}
              vital={settingToVital[props.chartSetting]!}
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
        const vital = settingToVital[props.chartSetting]!;
        const target = vitalDetailRouteWithQuery({
          orgSlug: organization.slug,
          query: eventView.generateQueryStringObject(),
          vitalName: vital,
          projectID: decodeList(location.query.project),
        });

        return (
          <Fragment>
            <div>
              <LinkButton
                onClick={handleViewAllClick}
                to={target}
                size="sm"
                data-test-id="view-all-button"
              >
                {t('View All')}
              </LinkButton>
            </div>
            {ContainerActions && <ContainerActions {...provided.widgetData.chart} />}
          </Fragment>
        );
      }}
      Queries={Queries}
      Visualizations={visualizations}
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
