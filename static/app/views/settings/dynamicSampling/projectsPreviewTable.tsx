import {useMemo} from 'react';

import {t} from 'sentry/locale';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const {useFormField} = organizationSamplingForm;

interface Props {
  isLoading: boolean;
  sampleCounts: ProjectSampleCount[];
}

export function ProjectsPreviewTable({isLoading, sampleCounts}: Props) {
  const {value: targetSampleRate, initialValue: initialTargetSampleRate} =
    useFormField('targetSampleRate');

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
    const targetRate = Math.min(100, Math.max(0, Number(debouncedTargetSampleRate) || 0));
    return balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: balancingItems,
    });
  }, [debouncedTargetSampleRate, balancingItems]);

  const initialSampleRateById = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(initialTargetSampleRate) || 0));
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: balancingItems,
    });
    return initialBalancedItems.reduce((acc, item) => {
      acc[item.id] = item.sampleRate;
      return acc;
    }, {});
  }, [initialTargetSampleRate, balancingItems]);

  const itemsWithFormattedNumbers = useMemo(() => {
    return balancedItems.map(item => ({
      ...item,
      sampleRate: formatNumberWithDynamicDecimalPoints(item.sampleRate * 100, 2),
      initialSampleRate: formatNumberWithDynamicDecimalPoints(
        initialSampleRateById[item.id] * 100,
        2
      ),
    }));
  }, [balancedItems, initialSampleRateById]);

  return (
    <ProjectsTable
      stickyHeaders
      emptyMessage={t('No active projects found in the selected period.')}
      isEmpty={!sampleCounts.length}
      isLoading={isLoading}
      items={itemsWithFormattedNumbers}
    />
  );
}
