import type React from 'react';
import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {clampPercentRate} from 'sentry/views/settings/dynamicSampling/utils/clampNumer';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const ITEMS_TO_SHOW = 5;
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
  const theme = useTheme();
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
  const palette = theme.chart.getColorPalette(ITEMS_TO_SHOW);

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
      ) : sampleCounts.length > 0 ? (
        <Fragment>
          <Breakdown>
            {topItems.map((item: any, index: any) => {
              const itemPercent = getSpanRate(item.sampledSpans);
              return (
                <Tooltip
                  key={item.project.id}
                  overlayStyle={{maxWidth: 'none'}}
                  title={
                    <Flex align="center" gap="sm" key={item.project.id}>
                      <ProjectBadge disableLink avatarSize={16} project={item.project} />
                      {formatPercent(itemPercent, {addSymbol: true})}
                      <SubText>{formatAbbreviatedNumber(item.sampledSpans)}</SubText>
                    </Flex>
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
                  <Flex align="center" gap="sm">
                    <OthersBadge />
                    {formatPercent(otherRate, {addSymbol: true})}
                    <SubText>{formatAbbreviatedNumber(total)}</SubText>
                  </Flex>
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
          <Flex align="start" gap="xl">
            <Legend>
              {topItems.map((item: any) => {
                const itemPercent = getSpanRate(item.sampledSpans);
                return (
                  <Flex align="center" gap="sm" key={item.project.id}>
                    <ProjectBadge avatarSize={16} project={item.project} />
                    {formatPercent(itemPercent, {addSymbol: true})}
                  </Flex>
                );
              })}
              {hasOthers && (
                <Flex align="center" gap="sm">
                  <OthersBadge />
                  {formatPercent(otherRate, {addSymbol: true})}
                </Flex>
              )}
            </Legend>
            <Total>
              <SubText>{t('Total Spans:')}</SubText>
              &nbsp;
              {formatAbbreviatedNumber(total)}
            </Total>
          </Flex>
        </Fragment>
      ) : (
        <EmptyStateText>{t('No spans found in the selected period.')}</EmptyStateText>
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
  font-size: ${p => p.theme.fontSize.md};
`;

const Breakdown = styled('div')`
  display: flex;
  height: ${space(2)};
  width: 100%;
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  background: ${p => p.theme.backgroundTertiary};
`;

const Legend = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin-top: ${space(1.5)};
  gap: ${space(1.5)};
  font-size: ${p => p.theme.fontSize.md};
  flex: 1;
`;

const Total = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1.5)};
  font-size: ${p => p.theme.fontSize.md};
  flex-shrink: 0;
`;

const SubText = styled('span')`
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;

const EmptyStateText = styled('div')`
  text-align: center;
  padding: ${space(0.5)} 0 ${space(3)};
  color: ${p => p.theme.subText};
`;
