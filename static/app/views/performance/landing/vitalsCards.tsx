import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toArray from 'sentry/utils/array/toArray';
import {WebVital} from 'sentry/utils/fields';
import type {
  VitalData,
  VitalsData,
} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';
import {
  makeVitalStateColors,
  VitalState,
} from 'sentry/views/performance/vitalDetail/utils';
import VitalPercents from 'sentry/views/performance/vitalDetail/vitalPercents';

type VitalBarProps = {
  data: VitalsData | null;
  isLoading: boolean;
  vital: WebVital | WebVital[];
  barHeight?: number;
  showBar?: boolean;
  showDetail?: boolean;
  showDurationDetail?: boolean;
  showStates?: boolean;
  showTooltip?: boolean;
  showVitalPercentNames?: boolean;
  showVitalThresholds?: boolean;
  value?: string;
};

export function VitalBar(props: VitalBarProps) {
  const theme = useTheme();
  const {
    isLoading,
    data,
    vital,
    value,
    showBar = true,
    showStates = false,
    showDurationDetail = false,
    showVitalPercentNames = true,
    showVitalThresholds = false,
    showDetail = true,
    showTooltip = false,
    barHeight,
  } = props;

  if (isLoading) {
    return showStates ? <Placeholder height="48px" /> : null;
  }

  const emptyState = showStates ? (
    <EmptyVitalBar small>{t('No vitals found')}</EmptyVitalBar>
  ) : null;

  if (!data) {
    return emptyState;
  }

  const counts: Pick<VitalData, 'poor' | 'meh' | 'good' | 'total'> = {
    poor: 0,
    meh: 0,
    good: 0,
    total: 0,
  };
  const vitals = toArray(vital);
  vitals.forEach(vitalName => {
    const c = data?.[vitalName] ?? {};
    (Object.keys(counts) as Array<keyof typeof counts>).forEach(
      countKey => (counts[countKey] += (c as any)[countKey])
    );
  });

  if (!counts.total) {
    return emptyState;
  }

  const p75: React.ReactNode = Array.isArray(vital)
    ? null
    : (value ?? getP75(data?.[vital] ?? null, vital));
  const percents = getPercentsFromCounts(counts);
  const colorStops = getColorStopsFromPercents(theme, percents);

  return (
    <Fragment>
      {showBar && (
        <StyledTooltip
          title={
            <VitalPercents
              vital={vital}
              percents={percents}
              showVitalPercentNames={false}
              showVitalThresholds={false}
              hideTooltips={showTooltip}
            />
          }
          disabled={!showTooltip}
          position="bottom"
        >
          <ColorBar barHeight={barHeight} colorStops={colorStops} />
        </StyledTooltip>
      )}
      {showDetail && (
        <BarDetail>
          {showDurationDetail && p75 && (
            <div>
              {t('The p75 for all transactions is ')}
              <strong>{p75}</strong>
            </div>
          )}

          <VitalPercents
            vital={vital}
            percents={percents}
            showVitalPercentNames={showVitalPercentNames}
            showVitalThresholds={showVitalThresholds}
          />
        </BarDetail>
      )}
    </Fragment>
  );
}

const EmptyVitalBar = styled(EmptyStateWarning)`
  height: 48px;
  padding: ${space(1.5)} 15%;
`;

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;

function getP75(data: VitalData | null, vitalName: WebVital): string {
  const p75 = data?.p75 ?? null;
  if (p75 === null) {
    return '\u2014';
  }
  return vitalName === WebVital.CLS ? p75.toFixed(2) : `${p75.toFixed(0)}ms`;
}

type Percent = {
  percent: number;
  vitalState: VitalState;
};

function getPercentsFromCounts({
  poor,
  meh,
  good,
  total,
}: Pick<VitalData, 'poor' | 'meh' | 'good' | 'total'>) {
  const poorPercent = poor / total;
  const mehPercent = meh / total;
  const goodPercent = good / total;

  const percents: Percent[] = [
    {
      vitalState: VitalState.GOOD,
      percent: goodPercent,
    },
    {
      vitalState: VitalState.MEH,
      percent: mehPercent,
    },
    {
      vitalState: VitalState.POOR,
      percent: poorPercent,
    },
  ];

  return percents;
}

function getColorStopsFromPercents(theme: Theme, percents: Percent[]) {
  return percents.map(({percent, vitalState}) => ({
    percent,
    color: makeVitalStateColors(theme)[vitalState],
  }));
}

const BarDetail = styled('div')`
  font-size: ${p => p.theme.fontSize.md};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    justify-content: space-between;
  }
`;
