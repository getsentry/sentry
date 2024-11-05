import {useMemo} from 'react';

import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';
import {useProjectSampleCounts} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const {useFormField} = organizationSamplingForm;

interface Props {
  period: '24h' | '30d';
}

export function ProjectsPreviewTable({period}: Props) {
  const {value: targetSampleRate, initialValue: initialTargetSampleRate} =
    useFormField('targetSampleRate');

  const {data, isPending, isError, refetch} = useProjectSampleCounts({period});

  const debouncedTargetSampleRate = useDebouncedValue(
    targetSampleRate,
    // For longer lists we debounce the input to avoid too many re-renders
    data.length > 100 ? 200 : 0
  );

  const {balancedItems} = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(debouncedTargetSampleRate) || 0));
    return balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: data,
    });
  }, [debouncedTargetSampleRate, data]);

  const initialSampleRatesBySlug = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(initialTargetSampleRate) || 0));
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: data,
    });
    return initialBalancedItems.reduce((acc, item) => {
      acc[item.id] = item.sampleRate;
      return acc;
    }, {});
  }, [initialTargetSampleRate, data]);

  const itemsWithFormattedNumbers = useMemo(() => {
    return balancedItems.map(item => ({
      ...item,
      sampleRate: formatNumberWithDynamicDecimalPoints(item.sampleRate * 100, 2),
      initialSampleRate: formatNumberWithDynamicDecimalPoints(
        initialSampleRatesBySlug[item.project.slug] * 100,
        2
      ),
    }));
  }, [balancedItems, initialSampleRatesBySlug]);

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <ProjectsTable
      stickyHeaders
      emptyMessage={t('No active projects found in the selected period.')}
      isEmpty={!data.length}
      isLoading={isPending}
      items={itemsWithFormattedNumbers}
    />
  );
}
