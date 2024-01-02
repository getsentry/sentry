import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import toUpper from 'lodash/toUpper';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getDuration} from 'sentry/utils/formatters';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/performance/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/performance/browser/webVitals/utils/scoreToStatus';
import {
  ProjectScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  onClick?: (webVital: WebVitals) => void;
  projectData?: TableData;
  projectScore?: ProjectScore;
  showTooltip?: boolean;
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

export default function WebVitalMeters({
  onClick,
  projectData,
  projectScore,
  showTooltip = true,
}: Props) {
  const theme = useTheme();

  if (!projectScore) {
    return null;
  }

  const webVitals = Object.keys(WEB_VITALS_METERS_CONFIG) as WebVitals[];
  const colors = theme.charts.getColorPalette(3);

  return (
    <Container>
      <Flex>
        {webVitals.map((webVital, index) => {
          const webVitalExists = projectScore[`${webVital}Score`] !== undefined;
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
                {showTooltip && (
                  <StyledQuestionTooltip
                    isHoverable
                    size="xs"
                    title={
                      <span>
                        {tct(
                          `The p75 [webVital] value and aggregate [webVital] score of your selected project(s).
                          Scores and values may share some (but not perfect) correlation.`,
                          {
                            webVital: toUpper(webVital),
                          }
                        )}
                        <br />
                        <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#performance-score">
                          {t('Find out how performance scores are calculated here.')}
                        </ExternalLink>
                      </span>
                    }
                  />
                )}
                <MeterHeader>{headerText}</MeterHeader>
                <MeterValueText>
                  <Dot color={colors[index]} />
                  {formattedMeterValueText}
                </MeterValueText>
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
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
`;

function MeterBarFooter({score}: {score: number | undefined}) {
  if (score === undefined) {
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

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: absolute;
  right: ${space(1)};
`;

export const Dot = styled('span')<{color: string}>`
  display: inline-block;
  margin-right: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  width: ${space(1)};
  height: ${space(1)};
  background-color: ${p => p.color};
`;
