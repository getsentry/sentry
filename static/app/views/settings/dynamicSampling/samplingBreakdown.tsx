import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const ITEMS_TO_SHOW = 5;
const palette = CHART_PALETTE[ITEMS_TO_SHOW - 1];

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  sampleCounts: ProjectSampleCount[];
  sampleRates: Record<string, number>;
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

export function SamplingBreakdown({sampleCounts, sampleRates, ...props}: Props) {
  const spansWithSampleRates = sampleCounts
    ?.map(item => {
      const sampledSpans = Math.floor(item.count * (sampleRates[item.project.id] ?? 1));
      return {
        project: item.project,
        sampledSpans,
      };
    })
    .toSorted((a, b) => b.sampledSpans - a.sampledSpans);

  const hasOthers = spansWithSampleRates.length > ITEMS_TO_SHOW;

  const topItems = hasOthers
    ? spansWithSampleRates.slice(0, ITEMS_TO_SHOW - 1)
    : spansWithSampleRates.slice(0, ITEMS_TO_SHOW);
  const otherSpanCount = spansWithSampleRates
    .slice(ITEMS_TO_SHOW - 1)
    .reduce((acc, item) => acc + item.sampledSpans, 0);
  const total = spansWithSampleRates.reduce((acc, item) => acc + item.sampledSpans, 0);

  const getSpanPercent = spanCount => (total === 0 ? 100 : (spanCount / total) * 100);
  const otherPercent = getSpanPercent(otherSpanCount);

  return (
    <div {...props}>
      <Heading>
        {t('Breakdown of stored spans')}
        <SubText>{t('Total: %s', formatAbbreviatedNumber(total))}</SubText>
      </Heading>
      <Breakdown>
        {topItems.map((item, index) => {
          return (
            <Tooltip
              key={item.project.id}
              overlayStyle={{maxWidth: 'none'}}
              title={
                <LegendItem key={item.project.id}>
                  <ProjectBadge disableLink avatarSize={16} project={item.project} />
                  {`${formatNumberWithDynamicDecimalPoints(getSpanPercent(item.sampledSpans))}%`}
                  <SubText>{formatAbbreviatedNumber(item.sampledSpans)}</SubText>
                </LegendItem>
              }
              skipWrapper
            >
              <div
                style={{
                  width: `${getSpanPercent(item.sampledSpans)}%`,
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
                {`${formatNumberWithDynamicDecimalPoints(otherPercent)}%`}
                <SubText>{formatAbbreviatedNumber(total)}</SubText>
              </LegendItem>
            }
            skipWrapper
          >
            <div
              style={{
                width: `${otherPercent}%`,
                backgroundColor: palette[palette.length - 1],
              }}
            />
          </Tooltip>
        )}
      </Breakdown>
      <Legend>
        {topItems.map(item => {
          return (
            <LegendItem key={item.project.id}>
              <ProjectBadge avatarSize={16} project={item.project} />
              {`${formatNumberWithDynamicDecimalPoints(getSpanPercent(item.sampledSpans))}%`}
            </LegendItem>
          );
        })}
        {hasOthers && (
          <LegendItem>
            <OthersBadge />
            {`${formatNumberWithDynamicDecimalPoints(otherPercent)}%`}
          </LegendItem>
        )}
      </Legend>
    </div>
  );
}

const Heading = styled('h6')`
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  justify-content: space-between;
`;

const Breakdown = styled('div')`
  display: flex;
  height: ${space(2)};
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const Legend = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin-top: ${space(1)};
  gap: ${space(1.5)};
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
