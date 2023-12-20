import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useRouter from 'sentry/utils/useRouter';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import {FunctionTrendsWidget} from './functionTrendsWidget';
import {SlowestFunctionsWidget} from './slowestFunctionsWidget';

export type WidgetOption =
  | 'slowest functions'
  | 'regressed functions'
  | 'improved functions';

interface LandingWidgetSelectorProps {
  cursorName: string;
  defaultWidget: WidgetOption;
  query: string;
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
    opt => {
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
    case 'slowest functions':
      return (
        <SlowestFunctionsWidget
          cursorName={cursorName}
          header={header}
          userQuery={functionQuery}
          widgetHeight={widgetHeight}
        />
      );
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
    default:
      throw new Error('unknown widget type');
  }
}

const WIDGET_OPTIONS: SelectOption<WidgetOption>[] = [
  {
    label: t('Slowest Functions'),
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

const StyledCompactSelect = styled(CompactSelect)`
  > button {
    border: None;
    padding: 0;
  }
`;
