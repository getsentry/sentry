import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {OrganizationSampleRateInput} from 'sentry/views/settings/dynamicSampling/organizationSampleRateInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';
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
  actions: React.ReactNode;
  isLoading: boolean;
  period: ProjectionSamplePeriod;
  sampleCounts: ProjectSampleCount[];
}

export function ProjectsPreviewTable({actions, isLoading, period, sampleCounts}: Props) {
  const sampleRateField = useFormField('targetSampleRate');

  const debouncedTargetSampleRate = useDebouncedValue(
    sampleRateField.value,
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
    const targetRate = parsePercent(sampleRateField.initialValue);
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate,
      items: balancingItems,
    });

    return mapArrayToObject({
      array: initialBalancedItems,
      keySelector: item => item.id,
      valueSelector: item => item.sampleRate,
    });
  }, [sampleRateField.initialValue, balancingItems]);

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
          value={sampleRateField.value}
          onChange={sampleRateField.onChange}
          previousValue={sampleRateField.initialValue}
          showPreviousValue={sampleRateField.hasChanged}
          error={sampleRateField.error}
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
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  justify-content: flex-end;
  gap: ${space(2)};
  padding: ${space(1.5)} ${space(2)};
`;
