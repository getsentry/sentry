import type React from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {clampPercentRate} from 'sentry/views/settings/dynamicSampling/utils/clampNumer';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const ITEMS_TO_SHOW = 5;
const palette = CHART_PALETTE[ITEMS_TO_SHOW - 1]!;

interface Props extends React.ComponentProps<typeof StyledPanel> {
  sampleCounts: ProjectSampleCount[];
  sampleRates: Record<string, number>;
  isLoading?: boolean;
}

function OthersBadge() {
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: ${space(0.75)};
      `}
    >
      <PlatformIcon
        css={css`
          width: 16px;
          height: 16px;
        `}
        platform="other"
      />
      {t('other projects')}
    </div>
  );
}

export function SamplingBreakdown({
  sampleCounts,
  sampleRates,
  isLoading,
  ...props
}: Props) {
  const spansWithSampleRates = sampleCounts
    ?.map(item => {
      const sampleRate = clampPercentRate(sampleRates[item.project.id] ?? 1);
      const sampledSpans = Math.floor(item.count * sampleRate);
      return {
        project: item.project,
        sampledSpans,
      };
    })
    .toSorted((a: any, b: any) => b.sampledSpans - a.sampledSpans);

  const hasOthers = spansWithSampleRates.length > ITEMS_TO_SHOW;

  const topItems = hasOthers
    ? spansWithSampleRates.slice(0, ITEMS_TO_SHOW - 1)
    : spansWithSampleRates.slice(0, ITEMS_TO_SHOW);
  const otherSpanCount = spansWithSampleRates
    .slice(ITEMS_TO_SHOW - 1)
    .reduce((acc: any, item: any) => acc + item.sampledSpans, 0);
  const total = spansWithSampleRates.reduce(
    (acc: any, item: any) => acc + item.sampledSpans,
    0
  );

  const getSpanRate = (spanCount: any) => (total === 0 ? 0 : spanCount / total);
  const otherRate = getSpanRate(otherSpanCount);

  return (
    <StyledPanel {...props}>
      <Heading>{t('Distribution of stored spans')}</Heading>
      {isLoading ? (
        <LoadingIndicator
          size={32}
          css={css`
            margin: 0;
          `}
        />
      ) : (
        <Fragment>
          <Breakdown>
            {topItems.map((item: any, index: any) => {
              const itemPercent = getSpanRate(item.sampledSpans);
              return (
                <Tooltip
                  key={item.project.id}
                  overlayStyle={{maxWidth: 'none'}}
                  title={
                    <LegendItem key={item.project.id}>
                      <ProjectBadge disableLink avatarSize={16} project={item.project} />
                      {formatPercent(itemPercent, {addSymbol: true})}
                      <SubText>{formatAbbreviatedNumber(item.sampledSpans)}</SubText>
                    </LegendItem>
                  }
                  skipWrapper
                >
                  <div
                    style={{
                      width: `${itemPercent * 100}%`,
                      backgroundColor: palette[index],
                    }}
                  />
                </Tooltip>
              );
            })}
            {hasOthers && (
              <Tooltip
                overlayStyle={{maxWidth: 'none'}}
                title={
                  <LegendItem>
                    <OthersBadge />
                    {formatPercent(otherRate, {addSymbol: true})}
                    <SubText>{formatAbbreviatedNumber(total)}</SubText>
                  </LegendItem>
                }
                skipWrapper
              >
                <div
                  style={{
                    width: `${otherRate * 100}%`,
                    backgroundColor: palette[palette.length - 1],
                  }}
                />
              </Tooltip>
            )}
          </Breakdown>
          <Footer>
            <Legend>
              {topItems.map((item: any) => {
                const itemPercent = getSpanRate(item.sampledSpans);
                return (
                  <LegendItem key={item.project.id}>
                    <ProjectBadge avatarSize={16} project={item.project} />
                    {formatPercent(itemPercent, {addSymbol: true})}
                  </LegendItem>
                );
              })}
              {hasOthers && (
                <LegendItem>
                  <OthersBadge />
                  {formatPercent(otherRate, {addSymbol: true})}
                </LegendItem>
              )}
            </Legend>
            <Total>
              <SubText>{t('Total Spans:')}</SubText>
              &nbsp;
              {formatAbbreviatedNumber(total)}
            </Total>
          </Footer>
        </Fragment>
      )}
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding: ${space(1.5)} ${space(2)};
  margin-bottom: ${space(1.5)};
`;

const Heading = styled('h6')`
  margin-bottom: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Footer = styled('div')`
  display: flex;
  gap: ${space(2)};
  align-items: flex-start;
`;

const Breakdown = styled('div')`
  display: flex;
  height: ${space(2)};
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  background: ${p => p.theme.backgroundTertiary};
`;

const Legend = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin-top: ${space(1.5)};
  gap: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  flex: 1;
`;

const Total = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  flex-shrink: 0;
`;

const LegendItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const SubText = styled('span')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
