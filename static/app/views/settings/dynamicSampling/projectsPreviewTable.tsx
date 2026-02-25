import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {OrganizationSampleRateInput} from 'sentry/views/settings/dynamicSampling/organizationSampleRateInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';
import type {
  ProjectionSamplePeriod,
  ProjectSampleCount,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

export interface ProjectsPreviewTableProps {
  actions: React.ReactNode;
  isLoading: boolean;
  onTargetSampleRateChange: (value: string) => void;
  period: ProjectionSamplePeriod;
  sampleCounts: ProjectSampleCount[];
  savedTargetSampleRate: string;
  targetSampleRate: string;
  targetSampleRateError?: string;
}

export function ProjectsPreviewTable({
  actions,
  isLoading,
  period,
  sampleCounts,
  targetSampleRate,
  savedTargetSampleRate,
  onTargetSampleRateChange,
  targetSampleRateError,
}: ProjectsPreviewTableProps) {
  const debouncedTargetSampleRate = useDebouncedValue(
    targetSampleRate,
    // For longer lists we debounce the input to avoid too many re-renders
    sampleCounts.length > 100 ? 200 : 0
  );

  const balancingItems = useMemo(
    () =>
      sampleCounts.map(item => ({
        ...item,
        // Add properties to match the BalancingItem type of the balanceSampleRate function
        id: item.project.id,
        sampleRate: 1,
      })),
    [sampleCounts]
  );

  const {balancedItems} = useMemo(() => {
    const targetRate = parsePercent(debouncedTargetSampleRate);
    return balanceSampleRate({
      targetSampleRate: targetRate,
      items: balancingItems,
    });
  }, [debouncedTargetSampleRate, balancingItems]);

  const initialSampleRatesById = useMemo(() => {
    const targetRate = parsePercent(savedTargetSampleRate);
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate,
      items: balancingItems,
    });

    return mapArrayToObject({
      array: initialBalancedItems,
      keySelector: item => item.id,
      valueSelector: item => item.sampleRate,
    });
  }, [savedTargetSampleRate, balancingItems]);

  const itemsWithFormattedNumbers = useMemo(() => {
    return balancedItems.map(item => ({
      ...item,
      sampleRate: formatPercent(item.sampleRate),
      initialSampleRate: formatPercent(initialSampleRatesById[item.id]!),
    }));
  }, [balancedItems, initialSampleRatesById]);

  const breakdownSampleRates = useMemo(
    () =>
      mapArrayToObject({
        array: balancedItems,
        keySelector: item => item.id,
        valueSelector: item => item.sampleRate,
      }),
    [balancedItems]
  );

  return (
    <Fragment>
      <SamplingBreakdown
        sampleCounts={sampleCounts}
        sampleRates={breakdownSampleRates}
        isLoading={isLoading}
      />
      <Panel>
        <OrganizationSampleRateInput
          value={targetSampleRate}
          onChange={onTargetSampleRateChange}
          previousValue={savedTargetSampleRate}
          showPreviousValue={targetSampleRate !== savedTargetSampleRate}
          error={targetSampleRateError}
          label={t('Target Sample Rate')}
          help={t(
            'Set a global sample rate for your entire organization. This will determine how much incoming traffic should be stored across all your projects.'
          )}
        />
        <ProjectsTable
          rateHeader={t('Target Rate')}
          canEdit={false}
          emptyMessage={t('No active projects found in the selected period.')}
          period={period}
          isLoading={isLoading}
          items={itemsWithFormattedNumbers}
        />
        <Footer>{actions}</Footer>
      </Panel>
    </Fragment>
  );
}

const Footer = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  display: flex;
  justify-content: flex-end;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;
