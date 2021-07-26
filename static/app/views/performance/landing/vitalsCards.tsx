import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'app/api';
import Card from 'app/components/card';
import EventsRequest from 'app/components/charts/eventsRequest';
import {HeaderTitle} from 'app/components/charts/styles';
import {getInterval} from 'app/components/charts/utils';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import Sparklines from 'app/components/sparklines';
import SparklinesLine from 'app/components/sparklines/line';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  Column,
  generateFieldAsString,
  getAggregateAlias,
  WebVital,
} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import VitalsCardsDiscoverQuery, {
  VitalData,
  VitalsData,
} from 'app/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeList} from 'app/utils/queryString';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import ColorBar from '../vitalDetail/colorBar';
import {
  vitalAbbreviations,
  vitalDetailRouteWithQuery,
  vitalMap,
  VitalState,
  vitalStateColors,
} from '../vitalDetail/utils';
import VitalPercents from '../vitalDetail/vitalPercents';

import {
  getDefaultDisplayFieldForPlatform,
  LandingDisplayField,
  vitalCardDetails,
} from './utils';

type FrontendCardsProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  frontendOnly?: boolean;
};

export function FrontendCards(props: FrontendCardsProps) {
  const {eventView, location, organization, projects, frontendOnly = false} = props;

  if (frontendOnly) {
    const defaultDisplay = getDefaultDisplayFieldForPlatform(projects, eventView);
    const isFrontend = defaultDisplay === LandingDisplayField.FRONTEND_PAGELOAD;

    if (!isFrontend) {
      return null;
    }
  }

  const vitals = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];

  return (
    <VitalsCardsDiscoverQuery
      eventView={eventView}
      location={location}
      orgSlug={organization.slug}
      vitals={vitals}
    >
      {({isLoading, vitalsData}) => {
        return (
          <VitalsContainer>
            {vitals.map(vital => {
              const target = vitalDetailRouteWithQuery({
                orgSlug: organization.slug,
                query: eventView.generateQueryStringObject(),
                vitalName: vital,
                projectID: decodeList(location.query.project),
              });

              const value = isLoading
                ? '\u2014'
                : getP75(vitalsData?.[vital] ?? null, vital);
              const chart = (
                <VitalBarContainer>
                  <VitalBar isLoading={isLoading} vital={vital} data={vitalsData} />
                </VitalBarContainer>
              );

              return (
                <Link
                  key={vital}
                  to={target}
                  data-test-id={`vitals-linked-card-${vitalAbbreviations[vital]}`}
                >
                  <VitalCard
                    title={vitalMap[vital] ?? ''}
                    tooltip={WEB_VITAL_DETAILS[vital].description ?? ''}
                    value={isLoading ? '\u2014' : value}
                    chart={chart}
                    minHeight={150}
                  />
                </Link>
              );
            })}
          </VitalsContainer>
        );
      }}
    </VitalsCardsDiscoverQuery>
  );
}

const VitalBarContainer = styled('div')`
  margin-top: ${space(1.5)};
`;

type BaseCardsProps = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
};

type GenericCardsProps = BaseCardsProps & {
  functions: Column[];
};

function GenericCards(props: GenericCardsProps) {
  const {api, eventView: baseEventView, location, organization, functions} = props;
  const {query} = location;
  const eventView = baseEventView.withColumns(functions);

  // construct request parameters for fetching chart data
  const globalSelection = eventView.getGlobalSelection();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : undefined;
  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : undefined;
  const interval =
    typeof query.sparkInterval === 'string'
      ? query.sparkInterval
      : getInterval(
          {
            start: start || null,
            end: end || null,
            period: globalSelection.datetime.period,
          },
          'low'
        );
  const apiPayload = eventView.getEventsAPIPayload(location);

  return (
    <DiscoverQuery
      location={location}
      eventView={eventView}
      orgSlug={organization.slug}
      limit={1}
      referrer="api.performance.vitals-cards"
    >
      {({isLoading: isSummaryLoading, tableData}) => (
        <EventsRequest
          api={api}
          organization={organization}
          period={globalSelection.datetime.period}
          project={globalSelection.projects}
          environment={globalSelection.environments}
          team={apiPayload.team}
          start={start}
          end={end}
          interval={interval}
          query={apiPayload.query}
          includePrevious={false}
          yAxis={eventView.getFields()}
          partial
        >
          {({results}) => {
            const series = results?.reduce((allSeries, oneSeries) => {
              allSeries[oneSeries.seriesName] = oneSeries.data.map(item => item.value);
              return allSeries;
            }, {});
            const details = vitalCardDetails(organization);

            return (
              <VitalsContainer>
                {functions.map(func => {
                  let fieldName = generateFieldAsString(func);

                  if (fieldName.includes('apdex')) {
                    // Replace apdex with explicit thresholds with a generic one for lookup
                    fieldName = 'apdex()';
                  }

                  const cardDetail = details[fieldName];
                  if (!cardDetail) {
                    Sentry.captureMessage(`Missing field '${fieldName}' in vital cards.`);
                    return null;
                  }

                  const {title, tooltip, formatter} = cardDetail;
                  const alias = getAggregateAlias(fieldName);
                  const rawValue = tableData?.data?.[0]?.[alias];

                  const data = series?.[fieldName];
                  const value =
                    isSummaryLoading || !defined(rawValue)
                      ? '\u2014'
                      : formatter(rawValue);
                  const chart = <SparklineChart data={data} />;
                  return (
                    <VitalCard
                      key={fieldName}
                      title={title}
                      tooltip={tooltip}
                      value={value}
                      chart={chart}
                      horizontal
                      minHeight={96}
                      isNotInteractive
                    />
                  );
                })}
              </VitalsContainer>
            );
          }}
        </EventsRequest>
      )}
    </DiscoverQuery>
  );
}

function _BackendCards(props: BaseCardsProps) {
  const {organization} = props;
  const functions: Column[] = [
    {
      kind: 'function',
      function: ['p75', 'transaction.duration', undefined, undefined],
    },
    {kind: 'function', function: ['tpm', '', undefined, undefined]},
    {kind: 'function', function: ['failure_rate', '', undefined, undefined]},
    organization.features.includes('project-transaction-threshold')
      ? {
          kind: 'function',
          function: ['apdex', '', undefined, undefined],
        }
      : {
          kind: 'function',
          function: ['apdex', `${organization.apdexThreshold}`, undefined, undefined],
        },
  ];
  return <GenericCards {...props} functions={functions} />;
}

export const BackendCards = withApi(_BackendCards);

type MobileCardsProps = BaseCardsProps & {
  showStallPercentage: boolean;
};

function _MobileCards(props: MobileCardsProps) {
  const functions: Column[] = [
    {
      kind: 'function',
      function: ['p75', 'measurements.app_start_cold', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p75', 'measurements.app_start_warm', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p75', 'measurements.frames_slow_rate', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['p75', 'measurements.frames_frozen_rate', undefined, undefined],
    },
  ];
  if (props.showStallPercentage) {
    functions.push({
      kind: 'function',
      function: ['p75', 'measurements.stall_percentage', undefined, undefined],
    });
  }
  return <GenericCards {...props} functions={functions} />;
}

export const MobileCards = withApi(_MobileCards);

type SparklineChartProps = {
  data: number[];
};

function SparklineChart(props: SparklineChartProps) {
  const {data} = props;
  const width = 150;
  const height = 24;
  const lineColor = theme.charts.getColorPalette(1)[0];
  return (
    <SparklineContainer data-test-id="sparkline" width={width} height={height}>
      <Sparklines data={data} width={width} height={height}>
        <SparklinesLine style={{stroke: lineColor, fill: 'none', strokeWidth: 3}} />
      </Sparklines>
    </SparklineContainer>
  );
}

type SparklineContainerProps = {
  width: number;
  height: number;
};

const SparklineContainer = styled('div')<SparklineContainerProps>`
  flex-grow: 4;
  max-height: ${p => p.height}px;
  max-width: ${p => p.width}px;
  margin: ${space(1)} ${space(0)} ${space(0.5)} ${space(3)};
`;

const VitalsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
`;

type VitalBarProps = {
  isLoading: boolean;
  data: VitalsData | null;
  vital: WebVital | WebVital[];
  value?: string;
  showBar?: boolean;
  showStates?: boolean;
  showDurationDetail?: boolean;
  showVitalPercentNames?: boolean;
};

export function VitalBar(props: VitalBarProps) {
  const {
    isLoading,
    data,
    vital,
    value,
    showBar = true,
    showStates = false,
    showDurationDetail = false,
    showVitalPercentNames = false,
  } = props;

  if (isLoading) {
    return showStates ? <Placeholder height="48px" /> : null;
  }

  const emptyState = showStates ? (
    <EmptyVitalBar small>{t('No vitals found')}</EmptyVitalBar>
  ) : null;

  if (!data) {
    return emptyState;
  }

  const counts: Pick<VitalData, 'poor' | 'meh' | 'good' | 'total'> = {
    poor: 0,
    meh: 0,
    good: 0,
    total: 0,
  };
  const vitals = Array.isArray(vital) ? vital : [vital];
  vitals.forEach(vitalName => {
    const c = data?.[vitalName] ?? {};
    Object.keys(counts).forEach(countKey => (counts[countKey] += c[countKey]));
  });

  if (!counts.total) {
    return emptyState;
  }

  const p75: React.ReactNode = Array.isArray(vital)
    ? null
    : value ?? getP75(data?.[vital] ?? null, vital);
  const percents = getPercentsFromCounts(counts);
  const colorStops = getColorStopsFromPercents(percents);

  return (
    <React.Fragment>
      {showBar && <ColorBar colorStops={colorStops} />}
      <BarDetail>
        {showDurationDetail && p75 && (
          <div data-test-id="vital-bar-p75">
            {t('The p75 for all transactions is ')}
            <strong>{p75}</strong>
          </div>
        )}
        <VitalPercents
          vital={vital}
          percents={percents}
          showVitalPercentNames={showVitalPercentNames}
        />
      </BarDetail>
    </React.Fragment>
  );
}

const EmptyVitalBar = styled(EmptyStateWarning)`
  height: 48px;
  padding: ${space(1.5)} 15%;
`;

type VitalCardProps = {
  title: string;
  tooltip: string;
  value: string | number;
  chart: React.ReactNode;
  minHeight?: number;
  horizontal?: boolean;
  isNotInteractive?: boolean;
};

function VitalCard(props: VitalCardProps) {
  const {chart, minHeight, horizontal, title, tooltip, value, isNotInteractive} = props;
  return (
    <StyledCard interactive={!isNotInteractive} minHeight={minHeight}>
      <HeaderTitle>
        <OverflowEllipsis>{t(title)}</OverflowEllipsis>
        <QuestionTooltip size="sm" position="top" title={tooltip} />
      </HeaderTitle>
      <CardContent horizontal={horizontal}>
        <CardValue>{value}</CardValue>
        {chart}
      </CardContent>
    </StyledCard>
  );
}

const CardContent = styled('div')<{horizontal?: boolean}>`
  width: 100%;
  display: flex;
  flex-direction: ${p => (p.horizontal ? 'row' : 'column')};
  justify-content: space-between;
`;

const StyledCard = styled(Card)<{minHeight?: number}>`
  color: ${p => p.theme.textColor};
  padding: ${space(2)} ${space(3)};
  align-items: flex-start;
  margin-bottom: ${space(2)};
  ${p => p.minHeight && `min-height: ${p.minHeight}px`};
`;

function getP75(data: VitalData | null, vitalName: WebVital): string {
  const p75 = data?.p75 ?? null;
  if (p75 === null) {
    return '\u2014';
  } else {
    return vitalName === WebVital.CLS ? p75.toFixed(2) : `${p75.toFixed(0)}ms`;
  }
}

type Percent = {
  vitalState: VitalState;
  percent: number;
};

function getPercentsFromCounts({poor, meh, good, total}) {
  const poorPercent = poor / total;
  const mehPercent = meh / total;
  const goodPercent = good / total;

  const percents: Percent[] = [
    {
      vitalState: VitalState.GOOD,
      percent: goodPercent,
    },
    {
      vitalState: VitalState.MEH,
      percent: mehPercent,
    },
    {
      vitalState: VitalState.POOR,
      percent: poorPercent,
    },
  ];

  return percents;
}

function getColorStopsFromPercents(percents: Percent[]) {
  return percents.map(({percent, vitalState}) => ({
    percent,
    color: vitalStateColors[vitalState],
  }));
}

const BarDetail = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    justify-content: space-between;
  }
`;

const CardValue = styled('div')`
  font-size: 32px;
  margin-top: ${space(1)};
`;

const OverflowEllipsis = styled('div')`
  ${overflowEllipsis};
`;
