import {useMemo} from 'react';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import {FunctionTrendsWidget} from './functionTrendsWidget';
import {SlowestFunctionsWidget} from './slowestFunctionsWidget';

export type WidgetOption =
  | 'slowest functions'
  | 'regressed functions'
  | 'improved functions';

interface LandingWidgetSelectorProps {
  defaultWidget: WidgetOption;
  query: string;
  storageKey: string;
  widgetHeight?: string;
}

export function LandingWidgetSelector({
  defaultWidget,
  storageKey,
  widgetHeight,
}: LandingWidgetSelectorProps) {
  const [selectedWidget, setSelectedWidget] = useSyncedLocalStorageState<WidgetOption>(
    storageKey,
    defaultWidget
  );

  const functionQuery = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    return conditions.formatString();
  }, []);

  const header = (
    <CompactSelect
      value={selectedWidget}
      options={WIDGET_OPTIONS}
      onChange={opt => setSelectedWidget(opt.value)}
      triggerProps={{borderless: true, size: 'zero'}}
      offset={4}
    />
  );

  switch (selectedWidget) {
    case 'slowest functions':
      return (
        <SlowestFunctionsWidget
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
        />
      );
    case 'regressed functions':
      return (
        <FunctionTrendsWidget
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
          header={header}
          trendFunction="p95()"
          trendType="improvement"
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
        />
      );
    default:
      throw new Error('unknown widget type');
  }
}

const WIDGET_OPTIONS: SelectOption<WidgetOption>[] = [
  {
    label: t('Suspect Functions'),
    value: 'slowest functions' as const,
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
