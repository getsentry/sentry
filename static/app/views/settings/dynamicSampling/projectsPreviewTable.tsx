import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
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

  const breakdownSampleRates = balancedItems.reduce((acc, item) => {
    acc[item.id] = item.sampleRate;
    return acc;
  }, {});

  return (
    <Fragment>
      <BreakdownPanel>
        {isLoading ? (
          <LoadingIndicator
            css={css`
              margin: ${space(4)} 0;
            `}
          />
        ) : (
          <SamplingBreakdown
            sampleCounts={sampleCounts}
            sampleRates={breakdownSampleRates}
          />
        )}
      </BreakdownPanel>

      <ProjectsTable
        stickyHeaders
        rateHeader={t('Estimated Rate')}
        inputTooltip={t('To edit project sample rates, switch to manual sampling mode.')}
        emptyMessage={t('No active projects found in the selected period.')}
        isEmpty={!sampleCounts.length}
        isLoading={isLoading}
        items={itemsWithFormattedNumbers}
      />
    </Fragment>
  );
}

const BreakdownPanel = styled(Panel)`
  margin-bottom: ${space(3)};
  padding: ${space(2)};
`;
