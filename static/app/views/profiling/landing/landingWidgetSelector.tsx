import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {DataState} from 'sentry/views/profiling/useLandingAnalytics';

import {FunctionTrendsWidget} from './functionTrendsWidget';
import {SlowestFunctionsWidget} from './slowestFunctionsWidget';

type WidgetOption =
  | 'slowest functions avg'
  | 'slowest functions p50'
  | 'slowest functions' // kept for backwards compatibility as the p75
  | 'slowest functions p95'
  | 'slowest functions p99'
  | 'regressed functions'
  | 'improved functions';

function getAnalyticsName(option: WidgetOption): string {
  return option === 'slowest functions' ? 'slowest functions p75' : option;
}

interface LandingWidgetSelectorProps {
  cursorName: string;
  defaultWidget: WidgetOption;
  storageKey: string;
  onDataState?: (dataState: DataState) => void;
  widgetHeight?: string;
}

export function LandingWidgetSelector({
  cursorName,
  defaultWidget,
  storageKey,
  onDataState,
  widgetHeight,
}: LandingWidgetSelectorProps) {
  const router = useRouter();
  const organization = useOrganization();

  const [selectedWidget, setSelectedWidget] = useSyncedLocalStorageState<WidgetOption>(
    storageKey,
    defaultWidget
  );

  const onWidgetChange = useCallback(
    (opt: any) => {
      const newQuery = omit(router.location.query, [cursorName]);
      router.push({
        pathname: router.location.pathname,
        query: newQuery,
      });
      setSelectedWidget(opt.value);
      trackAnalytics('profiling_views.landing.widget_change', {
        organization,
        source: getAnalyticsName(selectedWidget),
        target: getAnalyticsName(opt.value),
      });
    },
    [cursorName, router, selectedWidget, setSelectedWidget, organization]
  );

  const functionQuery = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    return conditions.formatString();
  }, []);

  const options = organization.features.includes('profiling-function-trends')
    ? [...SUSPECT_FUNCTIONS_WIDGET_OPTIONS, ...FUNCTION_TRENDS_WIDGET_OPTIONS]
    : SUSPECT_FUNCTIONS_WIDGET_OPTIONS;

  const header = (
    <StyledCompactSelect
      value={selectedWidget}
      options={options}
      onChange={onWidgetChange}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} borderless size="zero" />
      )}
      offset={4}
    />
  );

  if (organization.features.includes('profiling-function-trends')) {
    if (selectedWidget === 'regressed functions') {
      return (
        <FunctionTrendsWidget
          cursorName={cursorName}
          header={header}
          trendFunction="p95()"
          trendType="regression"
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    }

    if (selectedWidget === 'improved functions') {
      return (
        <FunctionTrendsWidget
          cursorName={cursorName}
          header={header}
          trendFunction="p95()"
          trendType="improvement"
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    }
  }

  switch (selectedWidget) {
    case 'slowest functions avg':
      return (
        <SlowestFunctionsWidget
          breakdownFunction="avg()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    case 'slowest functions p50':
      return (
        <SlowestFunctionsWidget
          breakdownFunction="p50()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    case 'slowest functions p95':
      return (
        <SlowestFunctionsWidget
          breakdownFunction="p95()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    case 'slowest functions p99':
      return (
        <SlowestFunctionsWidget
          breakdownFunction="p99()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
    case 'slowest functions':
    default:
      return (
        <SlowestFunctionsWidget
          breakdownFunction="p75()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
          onDataState={onDataState}
        />
      );
  }
}

const SUSPECT_FUNCTIONS_WIDGET_OPTIONS: Array<SelectOption<WidgetOption>> = [
  {
    label: t('Slowest Functions (breakdown by AVG)'),
    value: 'slowest functions avg' as const,
  },
  {
    label: t('Slowest Functions (breakdown by P50)'),
    value: 'slowest functions p50' as const,
  },
  {
    label: t('Slowest Functions (breakdown by P75)'),
    value: 'slowest functions' as const,
  },
  {
    label: t('Slowest Functions (breakdown by P95)'),
    value: 'slowest functions p95' as const,
  },
  {
    label: t('Slowest Functions (breakdown by P99)'),
    value: 'slowest functions p99' as const,
  },
];

const FUNCTION_TRENDS_WIDGET_OPTIONS: Array<SelectOption<WidgetOption>> = [
  {
    label: t('Most Regressed Functions'),
    value: 'regressed functions' as const,
  },
  {
    label: t('Most Improved Functions'),
    value: 'improved functions' as const,
  },
];

const StyledCompactSelect = styled(CompactSelect)`
  > button {
    border: None;
    padding: 0;
  }
`;
