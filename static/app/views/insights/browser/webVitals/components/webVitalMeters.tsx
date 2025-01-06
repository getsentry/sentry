import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import getDuration from 'sentry/utils/duration/getDuration';
import {VITAL_DESCRIPTIONS} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';

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
  inp: {
    name: t('Interaction to Next Paint'),
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

  const webVitalsConfig = WEB_VITALS_METERS_CONFIG;

  const webVitals = Object.keys(webVitalsConfig) as WebVitals[];
  const colors = theme.charts.getColorPalette(3) ?? [];

  const renderVitals = () => {
    return webVitals.map((webVital, index) => {
      const webVitalKey = `p75(measurements.${webVital})`;
      const score = projectScore[`${webVital}Score`];
      const meterValue = projectData?.data?.[0]?.[webVitalKey] as number;

      if (!score) {
        return null;
      }

      return (
        <VitalMeter
          key={webVital}
          webVital={webVital}
          showTooltip={showTooltip}
          score={score}
          meterValue={meterValue}
          color={colors[index]!}
          onClick={onClick}
        />
      );
    });
  };

  return (
    <Container>
      <Flex>{renderVitals()}</Flex>
    </Container>
  );
}

type VitalMeterProps = {
  color: string;
  meterValue: number | undefined;
  score: number | undefined;
  showTooltip: boolean;
  webVital: WebVitals;
  isAggregateMode?: boolean;
  onClick?: (webVital: WebVitals) => void;
};

export function VitalMeter({
  webVital,
  showTooltip,
  score,
  meterValue,
  color,
  onClick,
  isAggregateMode = true,
}: VitalMeterProps) {
  const webVitalsConfig = WEB_VITALS_METERS_CONFIG;
  const webVitalExists = score !== undefined;

  const formattedMeterValueText =
    webVitalExists && meterValue ? (
      webVitalsConfig[webVital].formatter(meterValue)
    ) : (
      <NoValue />
    );

  const webVitalKey = `measurements.${webVital}`;
  const {shortDescription} = VITAL_DESCRIPTIONS[webVitalKey];

  const headerText = webVitalsConfig[webVital].name;
  const meterBody = (
    <Fragment>
      <MeterBarBody>
        {showTooltip && (
          <StyledQuestionTooltip
            isHoverable
            size="xs"
            title={
              <span>
                {shortDescription}
                <br />
                <ExternalLink href={`${MODULE_DOC_LINK}#performance-score`}>
                  {t('Find out how performance scores are calculated here.')}
                </ExternalLink>
              </span>
            }
          />
        )}
        <MeterHeader>{headerText}</MeterHeader>
        <MeterValueText>
          <Dot color={color} />
          {formattedMeterValueText}
        </MeterValueText>
      </MeterBarBody>
      <MeterBarFooter score={score} />
    </Fragment>
  );
  return (
    <VitalContainer
      key={webVital}
      webVital={webVital}
      webVitalExists={webVitalExists}
      meterBody={meterBody}
      onClick={onClick}
      isAggregateMode={isAggregateMode}
    />
  );
}

type VitalContainerProps = {
  meterBody: React.ReactNode;
  webVital: WebVitals;
  webVitalExists: boolean;
  isAggregateMode?: boolean;
  onClick?: (webVital: WebVitals) => void;
};

function VitalContainer({
  webVital,
  webVitalExists,
  meterBody,
  onClick,
  isAggregateMode = true,
}: VitalContainerProps) {
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
          title={tct('No [webVital] data found in this [selection].', {
            webVital: webVital.toUpperCase(),
            selection: isAggregateMode ? 'project' : 'trace',
          })}
        >
          {meterBody}
        </StyledTooltip>
      )}
    </MeterBarContainer>
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
  background-color: ${p => p.theme.background};
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
  font-weight: ${p => p.theme.fontWeightBold};
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
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].border]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.5)};
  text-align: center;
`;

const NoValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.headerFontSize};
`;

function NoValue() {
  return <NoValueContainer>{' \u2014 '}</NoValueContainer>;
}

const StyledTooltip = styled(Tooltip)`
  display: block;
  width: 100%;
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

// A compressed version of the VitalMeter component used in the trace context panel
type VitalPillProps = Omit<
  VitalMeterProps,
  'showTooltip' | 'isAggregateMode' | 'onClick' | 'color'
>;
export function VitalPill({webVital, score, meterValue}: VitalPillProps) {
  const status = score !== undefined ? scoreToStatus(score) : 'none';
  const webVitalExists = score !== undefined;
  const webVitalsConfig = WEB_VITALS_METERS_CONFIG;

  const formattedMeterValueText =
    webVitalExists && meterValue ? (
      webVitalsConfig[webVital].formatter(meterValue)
    ) : (
      <NoValue />
    );

  const tooltipText = VITAL_DESCRIPTIONS[`measurements.${webVital}`];

  return (
    <VitalPillContainer>
      <Tooltip title={tooltipText?.shortDescription}>
        <VitalPillName status={status}>
          {`${webVital ? webVital.toUpperCase() : ''} (${STATUS_TEXT[status] ?? 'N/A'})`}
        </VitalPillName>
      </Tooltip>
      <VitalPillValue>{formattedMeterValueText}</VitalPillValue>
    </VitalPillContainer>
  );
}

const VitalPillContainer = styled('div')`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 30px;
`;

const VitalPillName = styled('div')<{status: string}>`
  display: flex;
  align-items: center;
  position: relative;

  height: 100%;
  padding: 0 ${space(1)};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].border]};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};

  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: ${space(0.25)};
  text-decoration-thickness: 1px;

  cursor: pointer;
`;

const VitalPillValue = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;

  height: 100%;
  padding: 0 ${space(0.5)};
  border: 1px solid ${p => p.theme.gray200};
  border-left: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;

  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  font-size: ${p => p.theme.fontSizeLarge};
`;
