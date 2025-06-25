import React, {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import ExternalLink from 'sentry/components/links/externalLink';
import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconIssues} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {VITAL_DESCRIPTIONS} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {WEB_VITALS_METERS_CONFIG} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import {
  getIssueQueryFilter,
  useWebVitalsIssuesQuery,
} from 'sentry/views/insights/browser/webVitals/queries/useWebVitalsIssuesQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import {
  type ProjectScore,
  WEB_VITAL_PERFORMANCE_ISSUES,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';

export type ProjectData = {
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.inp)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
};

type Props = {
  onClick?: (webVital: WebVitals) => void;
  projectData?: ProjectData[];
  projectScore?: ProjectScore;
  showTooltip?: boolean;
  transaction?: string;
};

export default function WebVitalMetersWithIssues({
  onClick,
  projectData,
  projectScore,
  showTooltip = true,
}: Props) {
  const theme = useTheme();
  if (!projectScore) {
    return null;
  }

  const colors = theme.chart.getColorPalette(3);

  const renderVitals = () => {
    return ORDER.map((webVital, index) => {
      const webVitalKey: keyof ProjectData = `p75(measurements.${webVital})`;
      const score = projectScore[`${webVital}Score`];
      const meterValue = projectData?.[0]?.[webVitalKey];

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

function VitalMeter({
  webVital,
  score,
  meterValue,
  onClick,
  isAggregateMode = true,
  showTooltip = true,
}: VitalMeterProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const webVitalExists = score !== undefined;

  const formattedMeterValueText =
    webVitalExists && meterValue ? (
      WEB_VITALS_METERS_CONFIG[webVital].formatter(meterValue)
    ) : (
      <NoValue />
    );

  const webVitalKey = `measurements.${webVital}`;
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const {shortDescription} = VITAL_DESCRIPTIONS[webVitalKey];

  const headerText = WEB_VITALS_METERS_CONFIG[webVital].name;
  const performanceIssues = WEB_VITAL_PERFORMANCE_ISSUES[webVital];
  const {data: issues} = useWebVitalsIssuesQuery(performanceIssues);
  const hasIssues = issues && issues.length > 0;
  const meterBody = (
    <Fragment>
      <MeterBarBody>
        <StyledIssuesButton
          to={getIssuesUrl({organization, webVital, selection})}
          aria-label={t('View Performance Issues')}
          icon={<IconIssues />}
          size="xs"
          onClick={event => {
            event.stopPropagation();
          }}
          disabled={!hasIssues}
          title={
            issues &&
            issues.length > 0 &&
            (issues.length === 1
              ? tct('There is 1 performance issue potentially affecting [webVital].', {
                  webVital: webVital.toUpperCase(),
                })
              : tct(
                  'There are [count] performance issues potentially affecting [webVital].',
                  {
                    count: issues.length > 5 ? '5+' : issues.length,
                    webVital: webVital.toUpperCase(),
                  }
                ))
          }
          tooltipProps={{
            isHoverable: true,
          }}
        >
          {hasIssues ? (issues.length > 5 ? '5+' : issues.length) : '—'}
        </StyledIssuesButton>
        <MeterHeader>
          {headerText}

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
        </MeterHeader>
        <MeterValueText>
          {formattedMeterValueText}
          {score && <PerformanceBadge score={score} />}
        </MeterValueText>
      </MeterBarBody>
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

const getIssuesUrl = ({
  organization,
  webVital,
  selection,
}: {
  organization: Organization;
  selection: PageFilters;
  webVital: WebVitals;
}) => {
  const query = getIssueQueryFilter(WEB_VITAL_PERFORMANCE_ISSUES[webVital]);
  return `/organizations/${organization.slug}/issues/?${qs.stringify({
    query,
    ...pageFiltersToQueryParams(selection),
  })}`;
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

const StyledIssuesButton = styled(LinkButton)`
  position: absolute;
  right: ${space(1)};
`;

// This style explicitly hides InteractionStateLayer when the Issues button is hovered
// This is to prevent hover styles displayed on multiple overlapping components simultaneously
const MeterBarContainer = styled('div')<{clickable?: boolean}>`
  background-color: ${p => p.theme.background};
  flex: 1;
  position: relative;
  padding: 0;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  min-width: 140px;

  :has(${StyledIssuesButton}:hover) > ${InteractionStateLayer} {
    display: none;
  }
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.textColor};
  display: flex;
  width: 100%;
  padding: 0 ${space(1)};
  align-items: center;
`;

const MeterValueText = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
  padding: 0 ${space(1)};
  gap: ${space(1)};
`;

const NoValueContainer = styled('span')`
  color: ${p => p.theme.subText};
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
  padding-left: ${space(0.5)};
`;
