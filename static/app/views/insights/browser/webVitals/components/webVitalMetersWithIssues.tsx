import React, {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconIssues} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {WebVital} from 'sentry/utils/fields';
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
  WEB_VITAL_PERFORMANCE_ISSUES,
  type ProjectScore,
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
  transaction,
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
          transaction={transaction}
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
  transaction?: string;
};

function VitalMeter({
  webVital,
  score,
  meterValue,
  onClick,
  transaction,
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

  const webVitalKey = `measurements.${webVital}` as WebVital;
  const {shortDescription} = VITAL_DESCRIPTIONS[webVitalKey]!;

  const headerText = WEB_VITALS_METERS_CONFIG[webVital].name;
  const issueTypes = WEB_VITAL_PERFORMANCE_ISSUES[webVital];
  const {data: issues} = useWebVitalsIssuesQuery({transaction, issueTypes, webVital});
  const hasIssues = issues && issues.length > 0;
  const meterBody = (
    <Fragment>
      <MeterBarBody>
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
          <StyledIssuesButton
            to={getIssuesUrl({organization, webVital, selection, transaction})}
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
      {webVitalExists && <StyledInteractionStateLayer />}
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
  transaction,
}: {
  organization: Organization;
  selection: PageFilters;
  webVital: WebVitals;
  transaction?: string;
}) => {
  const query = getIssueQueryFilter({
    issueTypes: WEB_VITAL_PERFORMANCE_ISSUES[webVital],
    webVital,
    transaction,
  });
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

// Issues Button starts to overlap with meter text at 1500px
const StyledIssuesButton = styled(LinkButton)`
  position: absolute;
  right: ${space(1)};

  @media (max-width: 1500px) {
    bottom: ${space(1)};
  }
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  border-radius: ${p => p.theme.radius.md};
`;

// This style explicitly hides InteractionStateLayer when the Issues button is hovered
// This is to prevent hover styles displayed on multiple overlapping components simultaneously
const MeterBarContainer = styled('div')<{clickable?: boolean}>`
  background-color: ${p => p.theme.tokens.background.primary};
  flex: 1;
  position: relative;
  padding: 0;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  min-width: 180px;

  :has(${StyledIssuesButton}:hover) > ${StyledInteractionStateLayer} {
    display: none;
  }
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  width: 100%;
  padding: 0 ${space(1)};
  align-items: center;
  white-space: nowrap;
`;

const MeterValueText = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.primary};
  flex: 1;
  text-align: center;
  padding: 0 ${space(1)};
  gap: ${space(1)};
  height: 30px;

  @media (max-width: 1500px) {
    font-size: ${p => p.theme.fontSize.lg};
  }
`;

const NoValueContainer = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xl};
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
