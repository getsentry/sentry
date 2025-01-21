import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useRouter from 'sentry/utils/useRouter';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import {FunctionTrendsWidget} from './functionTrendsWidget';
import {SlowestFunctionsWidget} from './slowestFunctionsWidget';

export type WidgetOption =
  | 'slowest functions avg'
  | 'slowest functions p50'
  | 'slowest functions' // kept for backwards compatibility as the p75
  | 'slowest functions p95'
  | 'slowest functions p99'
  | 'regressed functions'
  | 'improved functions';

interface LandingWidgetSelectorProps {
  cursorName: string;
  defaultWidget: WidgetOption;
  storageKey: string;
  widgetHeight?: string;
}

export function LandingWidgetSelector({
  cursorName,
  defaultWidget,
  storageKey,
  widgetHeight,
}: LandingWidgetSelectorProps) {
  const router = useRouter();

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
    },
    [cursorName, router, setSelectedWidget]
  );

  const functionQuery = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    return conditions.formatString();
  }, []);

  const header = (
    <StyledCompactSelect
      value={selectedWidget}
      options={WIDGET_OPTIONS}
      onChange={onWidgetChange}
      triggerProps={{borderless: true, size: 'zero'}}
      offset={4}
    />
  );

  switch (selectedWidget) {
    case 'regressed functions':
      return (
        <FunctionTrendsWidget
          cursorName={cursorName}
          header={header}
          trendFunction="p95()"
          trendType="regression"
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
        />
      );
    case 'improved functions':
      return (
        <FunctionTrendsWidget
          cursorName={cursorName}
          header={header}
          trendFunction="p95()"
          trendType="improvement"
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
        />
      );
    case 'slowest functions avg':
      return (
        <SlowestFunctionsWidget
          breakdownFunction="avg()"
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
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
        />
      );
  }
}

const WIDGET_OPTIONS: SelectOption<WidgetOption>[] = [
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
