import {useCallback, useMemo} from 'react';
import debounce from 'lodash/debounce';

import type {SelectOption} from '@sentry/scraps/compactSelect';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {capitalize} from 'sentry/utils/string/capitalize';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogSeverityLevel} from 'sentry/views/explore/logs/utils';

type FilterFields = {
  f_ol_search: string;
  f_ol_severity: string[];
};

type Options = {
  logItems: OurLogsResponseItem[];
};

type Return = {
  getSeverityLevels: () => Array<SelectOption<string>>;
  items: OurLogsResponseItem[];
  searchTerm: string;
  selectValues: Array<SelectOption<string>>;
  setSearchTerm: (searchTerm: string) => void;
  setSeverityLevel: (val: Array<SelectOption<string>>) => void;
};

const FILTERS = {
  severity: (item: OurLogsResponseItem, severities: string[]) => {
    if (severities.length === 0) {
      return true;
    }

    const severityText = item[OurLogKnownFieldKey.SEVERITY] as string | null;
    const severityNumber = item[OurLogKnownFieldKey.SEVERITY_NUMBER] as number | null;
    const level = getLogSeverityLevel(severityNumber, severityText);

    return severities.includes(level);
  },

  searchTerm: (item: OurLogsResponseItem, searchTerm: string) => {
    const message = item[OurLogKnownFieldKey.MESSAGE];
    return message?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
  },
};

function filterItems<T>(options: {
  filterFns: Record<string, (item: T, filterValue: any) => boolean>;
  filterVals: Record<string, any>;
  items: T[];
}): T[] {
  const {items, filterFns, filterVals} = options;

  return items.filter(item => {
    return Object.entries(filterFns).every(([key, filterFn]) => {
      const filterValue = filterVals[key];
      return filterFn(item, filterValue);
    });
  });
}

function useOurLogFilters({logItems}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const severityValues = useMemo(
    () => decodeList(query.f_ol_severity),
    [query.f_ol_severity]
  );
  const searchTerm = decodeScalar(query.f_ol_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: logItems,
        filterFns: FILTERS,
        filterVals: {severity: severityValues, searchTerm},
      }),
    [logItems, severityValues, searchTerm]
  );

  const getSeverityLevels = useCallback(() => {
    const severityLevels = Array.from(
      new Set(
        logItems.map(item => {
          const severityText = item[OurLogKnownFieldKey.SEVERITY] as string | null;
          const severityNumber = item[OurLogKnownFieldKey.SEVERITY_NUMBER] as
            | number
            | null;
          return getLogSeverityLevel(severityNumber, severityText);
        })
      )
    ).sort();

    return severityLevels.map(
      (value): SelectOption<string> => ({
        value,
        label: capitalize(value),
      })
    );
  }, [logItems]);

  const debouncedSetFilter = useMemo(
    () =>
      debounce((f_ol_search: string) => {
        setFilter({f_ol_search: f_ol_search || undefined});
      }, DEFAULT_DEBOUNCE_DURATION),
    [setFilter]
  );

  const setSearchTerm = useCallback(
    (f_ol_search: string) => debouncedSetFilter(f_ol_search),
    [debouncedSetFilter]
  );

  const setSeverityLevel = useCallback(
    (value: Array<SelectOption<string>>) => {
      setFilter({f_ol_severity: value.map(v => v.value)});
    },
    [setFilter]
  );

  return {
    getSeverityLevels,
    items,
    searchTerm,
    selectValues: severityValues.map(s => ({value: s, label: s, qs: 'f_ol_severity'})),
    setSeverityLevel,
    setSearchTerm,
  };
}

export default useOurLogFilters;
