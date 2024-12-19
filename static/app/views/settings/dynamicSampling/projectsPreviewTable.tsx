import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';
import type {
  ProjectionSamplePeriod,
  ProjectSampleCount,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const {useFormField} = organizationSamplingForm;

interface Props {
  isLoading: boolean;
  period: ProjectionSamplePeriod;
  sampleCounts: ProjectSampleCount[];
}

export function ProjectsPreviewTable({isLoading, period, sampleCounts}: Props) {
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
    const targetRate = parsePercent(debouncedTargetSampleRate);
    return balanceSampleRate({
      targetSampleRate: targetRate,
      items: balancingItems,
    });
  }, [debouncedTargetSampleRate, balancingItems]);

  const initialSampleRateById = useMemo(() => {
    const targetRate = parsePercent(initialTargetSampleRate);
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate,
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
      sampleRate: formatPercent(item.sampleRate),
      initialSampleRate: formatPercent(initialSampleRateById[item.id]),
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
        period={period}
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
