import React, {useEffect} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {
  INDUSTRY_STANDARDS,
  MIN_VITAL_COUNT_FOR_DISPLAY,
  SENTRY_CUSTOMERS,
} from 'sentry/components/performance/vitalsAlert/constants';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Tag from 'sentry/components/tag';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import VitalsCardDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {webVitalMeh, webVitalPoor} from 'sentry/views/performance/vitalDetail/utils';

type Score = 'poor' | 'meh' | 'good';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'start' | 'end' | 'statsPeriod'
>;

type Props = ViewProps & {
  location: Location;
  organization: Organization;
  vital: WebVital | WebVital[];
};

const SUPPORTED_VITALS = ['measurements.fcp', 'measurements.lcp'];

function getScore(vital: WebVital, value: number): Score {
  const poorScore = webVitalPoor[vital];
  const mehScore = webVitalMeh[vital];
  if (value > poorScore) {
    return 'poor';
  }
  if (value > mehScore) {
    return 'meh';
  }
  return 'good';
}

function getIndicatorString(score: Score) {
  switch (score) {
    case 'poor':
      return t('Poor');
    case 'meh':
      return t('Meh');
    default:
      return t('Good');
  }
}

function getTagLevel(score: Score) {
  switch (score) {
    case 'poor':
      return 'error';
    case 'meh':
      return 'warning';
    default:
      return 'success';
  }
}

function MetricsCard({
  title,
  vital,
  value,
  tooltip,
}: {
  title: string;
  tooltip: string;
  value: number;
  vital: WebVital;
}) {
  // round to 2 decimals if <10s, otherwise use just 1 decimal
  const score = getScore(vital, value);
  const numDecimals = value >= 10_000 ? 1 : 2;
  const timeInSeconds = value / 1000.0;
  return (
    <MetricsCardWrapper>
      <MetricsTitle>
        {title} (p75) <StyledQuestionTooltip title={tooltip} size="xs" />
      </MetricsTitle>
      <ScoreWrapper>
        <ScoreContent>{timeInSeconds.toFixed(numDecimals)}s</ScoreContent>
        <TagWrapper>
          <StyledTag type={getTagLevel(score)}>{getIndicatorString(score)}</StyledTag>
        </TagWrapper>
      </ScoreWrapper>
    </MetricsCardWrapper>
  );
}

function ContentWrapper({
  organization,
  vital,
  children,
  count,
  p75,
}: {
  children: React.ReactNode;
  count: number;
  organization: Organization;
  p75: number;
  vital: WebVital;
}) {
  useEffect(() => {
    trackAdvancedAnalyticsEvent('performance_views.vital_detail.comparison_viewed', {
      organization,
      vital,
      count,
      p75,
    });
  });
  return <Container>{children}</Container>;
}

function VitalsComparison(props: Props) {
  const {location, vital: _vital, organization} = props;
  const vitals = Array.isArray(_vital) ? _vital : [_vital];
  const vital = vitals[0];
  if (!SUPPORTED_VITALS.includes(vital)) {
    return null;
  }
  return (
    <VitalsCardDiscoverQuery location={location} vitals={vitals}>
      {({isLoading, vitalsData}) => {
        if (isLoading || !vitalsData) {
          return null;
        }
        const {p75} = vitalsData[vital];
        if (!p75) {
          return null;
        }
        const lookupName = vital === 'measurements.fcp' ? 'FCP' : 'LCP';
        const sentryStandard = SENTRY_CUSTOMERS[lookupName];
        const industryStandard = INDUSTRY_STANDARDS[lookupName];
        const count = vitalsData[vital].total;
        // only show it if we hit the min number
        if (count < MIN_VITAL_COUNT_FOR_DISPLAY) {
          return null;
        }
        return (
          <ContentWrapper {...{organization, vital, count, p75}}>
            <MetricsCard
              title={t('Selected Projects')}
              vital={vital}
              value={p75}
              tooltip={tct(
                "25% of your project's transactions have an [lookupName] greater than this number. Good, Bad, Meh segmentation is based on Google industry standards.",
                {lookupName}
              )}
            />
            <MetricsCard
              title={t('Sentry Peers')}
              vital={vital}
              value={sentryStandard}
              tooltip={tct(
                '20% of Sentry customers have a p75 [lookupName] lower than this.',
                {lookupName}
              )}
            />
            <MetricsCard
              title={t('Industry Standard')}
              vital={vital}
              value={industryStandard}
              tooltip={tct(
                "Calculated as a Good [lookupName] based on Google's industry standards.",
                {lookupName}
              )}
            />
          </ContentWrapper>
        );
      }}
    </VitalsCardDiscoverQuery>
  );
}

export default VitalsComparison;

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: ${space(2)};
`;

const ScoreContent = styled('h6')`
  margin: auto;
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const MetricsCardWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  border: 1px ${p => p.theme.gray200};
  border-radius: 4px;
  border-style: solid;
  align-items: center;
  height: 57px;
  padding: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledTag = styled(Tag)`
  margin-left: ${space(1)};
`;

const MetricsTitle = styled('span')`
  font-size: 14px;
`;

const TagWrapper = styled('span')`
  margin: auto;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
`;
