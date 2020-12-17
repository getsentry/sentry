import React from 'react';
import styled from '@emotion/styled';

import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, SelectValue} from 'app/types';
import {WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';

export enum YAxis {
  SESSIONS = 'sessions',
  USERS = 'users',
  CRASH_FREE = 'crashFree',
  SESSION_DURATION = 'sessionDuration',
  EVENTS = 'events',
  FAILED_TRANSACTIONS = 'failedTransactions',
  COUNT_DURATION = 'countDuration',
  COUNT_VITAL = 'countVital',
}

export enum EventType {
  ALL = 'all',
  CSP = 'csp',
  DEFAULT = 'default',
  ERROR = 'error',
  TRANSACTION = 'transaction',
}

export const PERFORMANCE_AXIS = [
  YAxis.FAILED_TRANSACTIONS,
  YAxis.COUNT_DURATION,
  YAxis.COUNT_VITAL,
];

type Props = {
  summary: React.ReactNode;
  yAxis: YAxis;
  onYAxisChange: (value: YAxis) => void;
  eventType: EventType;
  onEventTypeChange: (value: EventType) => void;
  vitalType: WebVital;
  onVitalTypeChange: (value: WebVital) => void;
  organization: Organization;
  hasHealthData: boolean;
  hasDiscover: boolean;
  hasPerformance: boolean;
};

const ReleaseChartControls = ({
  summary,
  yAxis,
  onYAxisChange,
  organization,
  hasHealthData,
  hasDiscover,
  hasPerformance,
  eventType = EventType.ALL,
  onEventTypeChange,
  vitalType = WebVital.LCP,
  onVitalTypeChange,
}: Props) => {
  const noHealthDataTooltip = !hasHealthData
    ? t('This view is only available with release health data.')
    : undefined;
  const noDiscoverTooltip = !hasDiscover
    ? t('This view is only available with Discover.')
    : undefined;
  const noPerformanceTooltip = !hasPerformance
    ? t('This view is only available with Performance Monitoring.')
    : undefined;
  const yAxisOptions: SelectValue<YAxis>[] = [
    {
      value: YAxis.SESSIONS,
      label: t('Session Count'),
      disabled: !hasHealthData,
      tooltip: noHealthDataTooltip,
    },
    {
      value: YAxis.SESSION_DURATION,
      label: t('Session Duration'),
      disabled: !hasHealthData,
      tooltip: noHealthDataTooltip,
    },
    {
      value: YAxis.USERS,
      label: t('User Count'),
      disabled: !hasHealthData,
      tooltip: noHealthDataTooltip,
    },
    {
      value: YAxis.CRASH_FREE,
      label: t('Crash Free Rate'),
      disabled: !hasHealthData,
      tooltip: noHealthDataTooltip,
    },
    {
      value: YAxis.FAILED_TRANSACTIONS,
      label: t('Failure Count'),
      disabled: !hasPerformance,
      tooltip: noPerformanceTooltip,
    },
    {
      value: YAxis.COUNT_DURATION,
      label: t('Slow Duration Count'),
      disabled: !hasPerformance,
      tooltip: noPerformanceTooltip,
    },
    {
      value: YAxis.COUNT_VITAL,
      label: t('Slow Vital Count'),
      disabled: !hasPerformance,
      tooltip: noPerformanceTooltip,
    },
    {
      value: YAxis.EVENTS,
      label: t('Event Count'),
      disabled: !hasDiscover,
      tooltip: noDiscoverTooltip,
    },
  ];

  const getSummaryHeading = () => {
    switch (yAxis) {
      case YAxis.USERS:
        return t('Total Active Users');
      case YAxis.CRASH_FREE:
        return t('Average Rate');
      case YAxis.SESSION_DURATION:
        return t('Median Duration');
      case YAxis.EVENTS:
        return t('Total Events');
      case YAxis.FAILED_TRANSACTIONS:
        return t('Failed Transactions');
      case YAxis.COUNT_DURATION:
        return t('Count over %sms', organization.apdexThreshold);
      case YAxis.COUNT_VITAL:
        return vitalType !== WebVital.CLS
          ? t('Count over %sms', WEB_VITAL_DETAILS[vitalType].failureThreshold)
          : t('Count over %s', WEB_VITAL_DETAILS[vitalType].failureThreshold);
      case YAxis.SESSIONS:
      default:
        return t('Total Sessions');
    }
  };

  return (
    <StyledChartControls>
      <InlineContainer>
        <SectionHeading key="total-label">{getSummaryHeading()}</SectionHeading>
        <SectionValue key="total-value">{summary}</SectionValue>
        {(yAxis === YAxis.EVENTS || PERFORMANCE_AXIS.includes(yAxis)) && (
          <QuestionTooltip
            position="top"
            size="sm"
            title="This count includes only the current release."
          />
        )}
      </InlineContainer>
      <InlineContainer>
        <SecondarySelector
          yAxis={yAxis}
          eventType={eventType}
          onEventTypeChange={onEventTypeChange}
          vitalType={vitalType}
          onVitalTypeChange={onVitalTypeChange}
        />
        <OptionSelector
          title={t('Display')}
          selected={yAxis}
          options={yAxisOptions}
          onChange={onYAxisChange as (value: string) => void}
        />
      </InlineContainer>
    </StyledChartControls>
  );
};

const eventTypeOptions: SelectValue<EventType>[] = [
  {value: EventType.ALL, label: t('All')},
  {value: EventType.CSP, label: t('CSP')},
  {value: EventType.DEFAULT, label: t('Default')},
  {value: EventType.ERROR, label: 'Error'},
  {value: EventType.TRANSACTION, label: t('Transaction')},
];

const vitalTypeOptions: SelectValue<WebVital>[] = [
  WebVital.FP,
  WebVital.FCP,
  WebVital.LCP,
  WebVital.FID,
  WebVital.CLS,
].map(vital => ({value: vital, label: WEB_VITAL_DETAILS[vital].name}));

type SecondarySelectorProps = {
  yAxis: YAxis;
  eventType: EventType;
  onEventTypeChange: (v: EventType) => void;
  vitalType: WebVital;
  onVitalTypeChange: (v: WebVital) => void;
};

function SecondarySelector({
  yAxis,
  eventType,
  onEventTypeChange,
  vitalType,
  onVitalTypeChange,
}: SecondarySelectorProps) {
  switch (yAxis) {
    case YAxis.EVENTS:
      return (
        <OptionSelector
          title={t('Event Type')}
          selected={eventType}
          options={eventTypeOptions}
          onChange={onEventTypeChange as (value: string) => void}
        />
      );
    case YAxis.COUNT_VITAL:
      return (
        <OptionSelector
          title={t('Vital')}
          selected={vitalType}
          options={vitalTypeOptions}
          onChange={onVitalTypeChange as (value: string) => void}
        />
      );
    default:
      return null;
  }
}

const StyledChartControls = styled(ChartControls)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    grid-gap: ${space(1)};
    padding-bottom: ${space(1.5)};
    button {
      font-size: ${p => p.theme.fontSizeSmall};
    }
  }
`;

export default ReleaseChartControls;
