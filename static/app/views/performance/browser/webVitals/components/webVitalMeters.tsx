import {Fragment} from 'react';
import styled from '@emotion/styled';
import toUpper from 'lodash/toUpper';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getDuration} from 'sentry/utils/formatters';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/performance/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/performance/browser/webVitals/utils/scoreToStatus';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  onClick?: (webVital: WebVitals) => void;
  projectData?: TableData;
  projectScore?: ProjectScore;
  transaction?: string;
};

const WEB_VITALS_METERS_CONFIG = {
  lcp: {
    name: t('Largest Contentful Paint'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  fcp: {
    name: t('First Contentful Paint'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  fid: {
    name: t('First Input Delay'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
  cls: {
    name: t('Cumulative Layout Shift'),
    formatter: (value: number) => Math.round(value * 100) / 100,
  },
  ttfb: {
    name: t('Time To First Byte'),
    formatter: (value: number) => getFormattedDuration(value / 1000),
  },
};

export default function WebVitalMeters({onClick, projectData, projectScore}: Props) {
  if (!projectScore) {
    return null;
  }

  const webVitals = Object.keys(WEB_VITALS_METERS_CONFIG) as WebVitals[];

  return (
    <Container>
      <Flex>
        {webVitals.map(webVital => {
          const webVitalExists = projectScore[`${webVital}Score`] !== null;
          const formattedMeterValueText = webVitalExists ? (
            WEB_VITALS_METERS_CONFIG[webVital].formatter(
              projectData?.data?.[0]?.[`p75(measurements.${webVital})`] as number
            )
          ) : (
            <NoValue />
          );
          const headerText = WEB_VITALS_METERS_CONFIG[webVital].name;
          const meterBody = (
            <Fragment>
              <MeterBarBody>
                <MeterHeader>{headerText}</MeterHeader>
                <MeterValueText>{formattedMeterValueText}</MeterValueText>
              </MeterBarBody>
              <MeterBarFooter score={projectScore[`${webVital}Score`]} />
            </Fragment>
          );
          return (
            <MeterBarContainer
              key={webVital}
              onClick={() => webVitalExists && onClick?.(webVital)}
              clickable={webVitalExists}
            >
              {webVitalExists && <InteractionStateLayer />}
              {webVitalExists && meterBody}
              {!webVitalExists && (
                <StyledTooltip
                  title={tct('No [webVital] data found in this project.', {
                    webVital: toUpper(webVital),
                  })}
                >
                  {meterBody}
                </StyledTooltip>
              )}
            </MeterBarContainer>
          );
        })}
      </Flex>
    </Container>
  );
}

export const getFormattedDuration = (value: number) => {
  return getDuration(value, value < 1 ? 0 : 2, true);
};

const Container = styled('div')`
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  gap: ${p => (p.gap ? `${p.gap}px` : space(1))};
  align-items: center;
  flex-wrap: wrap;
`;

const MeterBarContainer = styled('div')<{clickable?: boolean}>`
  flex: 1;
  position: relative;
  padding: 0;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  min-width: 140px;
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border-bottom: none;
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  display: inline-block;
  text-align: center;
  width: 100%;
`;

const MeterValueText = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
`;

function MeterBarFooter({score}: {score: number | null}) {
  if (score === null) {
    return (
      <MeterBarFooterContainer status="none">{t('No Data')}</MeterBarFooterContainer>
    );
  }
  const status = scoreToStatus(score);
  return (
    <MeterBarFooterContainer status={status}>
      {STATUS_TEXT[status]} {score}
    </MeterBarFooterContainer>
  );
}

const MeterBarFooterContainer = styled('div')<{status: string}>`
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.5)};
  text-align: center;
`;

const NoValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

function NoValue() {
  return <NoValueContainer>{' \u2014 '}</NoValueContainer>;
}

const StyledTooltip = styled(Tooltip)`
  display: block;
`;
