import {ReactNode, useState} from 'react';

import Tag from 'sentry/components/tag';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {useMEPSettingContext} from './metricsEnhancedSetting';
import {createDefinedContext} from './utils';

interface MetricsEnhancedPerformanceDataContext {
  setIsMetricsData: (value?: boolean) => void;
  isMetricsData?: boolean;
}

const [_MEPDataProvider, _useMEPDataContext] =
  createDefinedContext<MetricsEnhancedPerformanceDataContext>({
    name: 'MetricsEnhancedPerformanceDataContext',
  });

export const MEPDataProvider = ({children}: {children: ReactNode}) => {
  const [isMetricsData, setIsMetricsData] = useState<boolean | undefined>(undefined); // Uses undefined to cover 'not initialized'
  return (
    <_MEPDataProvider value={{isMetricsData, setIsMetricsData}}>
      {children}
    </_MEPDataProvider>
  );
};

export const useMEPDataContext = _useMEPDataContext;

export const MEPTag = () => {
  const {isMetricsData} = useMEPDataContext();
  const {isMEPEnabled} = useMEPSettingContext();
  const organization = useOrganization();

  if (!organization.features.includes('performance-use-metrics')) {
    // Separate if for easier flag deletion
    return null;
  }

  // - If MEP is not enabled but they have the flag, always show sampled (corresponds to 'always show sampled')
  // - If isMetricsData is false it means a result was returned (not undefined) and is sampled
  // - If isMetricsData is true it means a result was returned and is metrics (unsampled)
  // - If isMetricsData is undefined it means a result was not been returned so we don't want to show sampled.
  if (isMEPEnabled && isMetricsData !== false) {
    return <span data-test-id="no-metrics-data-tag" />;
  }

  return (
    <Tag
      tooltipText={t(
        'These search conditions are only applicable to sampled transaction data. To edit sampling rates, go to Filters & Sampling in settings.'
      )}
      data-test-id="has-metrics-data-tag"
    >
      {'Sampled'}
    </Tag>
  );
};
