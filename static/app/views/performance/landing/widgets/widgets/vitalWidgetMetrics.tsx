import {Fragment, useMemo, useState} from 'react';

import Button from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {WebVital} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {vitalDetailRouteWithQuery} from 'sentry/views/performance/vitalDetail/utils';
import {_VitalChart} from 'sentry/views/performance/vitalDetail/vitalChart';

import {excludeTransaction} from '../../utils';
import {VitalBar} from '../../vitalsCards';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import SelectableList, {
  GrowLink,
  ListClose,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {
  transformMetricsToVitalList,
  VitalsMetricsItem,
} from '../transforms/transformMetricsToVitalList';
import {transformMetricsToVitalSeries} from '../transforms/transformMetricsToVitalSeries';
import {PerformanceWidgetProps, QueryDefinition, WidgetDataResult} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

import {VitalBarCell} from './vitalWidget';

const settingToVital: {[x: string]: WebVital} = {
  [PerformanceWidgetSetting.WORST_LCP_VITALS]: WebVital.LCP,
  [PerformanceWidgetSetting.WORST_FCP_VITALS]: WebVital.FCP,
  [PerformanceWidgetSetting.WORST_FID_VITALS]: WebVital.FID,
  [PerformanceWidgetSetting.WORST_CLS_VITALS]: WebVital.CLS,
};

type DataType = {
  list: WidgetDataResult & ReturnType<typeof transformMetricsToVitalList>;
  chart: WidgetDataResult & ReturnType<typeof transformMetricsToVitalSeries>;
};

export function VitalWidgetMetrics(props: PerformanceWidgetProps) {
  const api = useApi();
  const {ContainerActions, eventView, organization, location, chartSetting} = props;
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const field = props.fields[0];
  const metricsField = `avg(${field})`;
  const vital = settingToVital[chartSetting];

  const Queries = {
    list: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        fields: [metricsField],
        component: ({start, end, period, project, environment, children, fields}) => (
          <MetricsRequest
            api={api}
            organization={organization}
            start={start}
            end={end}
            statsPeriod={period}
            project={project}
            environment={environment}
            query="" // TODO(metrics): make this dynamic once api is ready
            interval="1h" // TODO(metrics): make this dynamic once api is ready
            field={decodeList(fields)}
            groupBy={['transaction', 'measurement_rating']}
            orderBy={decodeList(fields)[0]}
            limit={3}
          >
            {children}
          </MetricsRequest>
        ),
        transform: transformMetricsToVitalList,
      }),
      [eventView, metricsField, organization.slug]
    ),
    chart: useMemo<QueryDefinition<DataType, WidgetDataResult>>(
      () => ({
        enabled: widgetData => {
          return !!widgetData?.list?.data?.length;
        },
        fields: [metricsField],
        component: ({start, end, period, project, environment, children, fields}) => (
          <MetricsRequest
            api={api}
            organization={organization}
            start={start}
            end={end}
            statsPeriod={period}
            project={project}
            environment={environment}
            query="transaction:foo" // TODO(metrics): make this dynamic once api is ready (widgetData.list.data[selectedListIndex].transaction)
            interval="1h" // TODO(metrics): make this dynamic once api is ready
            field={decodeList(fields)}
            groupBy={['measurement_rating']}
          >
            {children}
          </MetricsRequest>
        ),
        transform: transformMetricsToVitalSeries,
      }),
      [chartSetting, selectedListIndex]
    ),
  };

  const handleViewAllClick = () => {
    // TODO(k-fish): Add analytics.
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={provided => {
        const {widgetData} = provided;
        const listItem = widgetData.list?.data[selectedListIndex];

        if (!listItem) {
          return <Subtitle> </Subtitle>;
        }

        const data = {
          [vital]: getVitalDataForListItem(listItem),
        };

        return (
          <Subtitle>
            <VitalBar
              isLoading={widgetData.list?.isLoading}
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
            const {widgetData} = provided;
            return (
              <SelectableList
                selectedIndex={selectedListIndex}
                setSelectedIndex={setSelectListIndex}
                items={widgetData.list.data.map(listItem => () => {
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
                          isLoading={widgetData.list?.isLoading}
                          vital={vital}
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
            );
          },
          height: 124,
          noPadding: true,
        },
      ]}
    />
  );
}

function getVitalDataForListItem(listItem: VitalsMetricsItem) {
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
