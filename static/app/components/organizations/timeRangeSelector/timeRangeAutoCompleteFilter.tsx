import autoCompleteFilter from 'sentry/components/dropdownAutoComplete/autoCompleteFilter';
import {ItemsAfterFilter} from 'sentry/components/dropdownAutoComplete/types';
import {t, tn} from 'sentry/locale';

import TimeRangeItemLabel from './timeRangeItemLabel';

const SUPPORTED_RELATIVE_PERIOD_UNITS = {
  s: {
    label: (num: number) => tn('Last second', 'Last %s seconds', num),
    searchKey: t('seconds'),
  },
  m: {
    label: (num: number) => tn('Last minute', 'Last %s minutes', num),
    searchKey: t('minutes'),
  },
  h: {
    label: (num: number) => tn('Last hour', 'Last %s hours', num),
    searchKey: t('hours'),
  },
  d: {
    label: (num: number) => tn('Last day', 'Last %s days', num),
    searchKey: t('days'),
  },
  w: {
    label: (num: number) => tn('Last week', 'Last %s weeks', num),
    searchKey: t('weeks'),
  },
};

const SUPPORTED_RELATIVE_UNITS_LIST = Object.keys(
  SUPPORTED_RELATIVE_PERIOD_UNITS
) as Array<keyof typeof SUPPORTED_RELATIVE_PERIOD_UNITS>;

function makeItem(
  amount: number,
  unit: keyof typeof SUPPORTED_RELATIVE_PERIOD_UNITS,
  index: number
) {
  return {
    value: `${amount}${unit}`,
    ['data-test-id']: `${amount}${unit}`,
    label: (
      <TimeRangeItemLabel>
        {SUPPORTED_RELATIVE_PERIOD_UNITS[unit].label(amount)}
      </TimeRangeItemLabel>
    ),
    searchKey: `${amount}${unit}`,
    index,
  };
}

/**
 * A custom autocomplete implementation for <TimeRangeSelector />
 * This function generates relative time ranges based on the user's input (not limited to those present in the initial set).
 *
 * When the user begins their input with a number, we provide all unit options for them to choose from:
 * "5" => ["Last 5 seconds", "Last 5 minutes", "Last 5 hours", "Last 5 days", "Last 5 weeks"]
 *
 * When the user adds text after the number, we filter those options to the matching unit:
 * "5d" => ["Last 5 days"]
 * "5 days" => ["Last 5 days"]
 *
 * If the input does not begin with a number, we do a simple filter of the preset options.
 */
const timeRangeAutoCompleteFilter: typeof autoCompleteFilter = function (
  items,
  filterValue
) {
  if (!items) {
    return [];
  }

  const match = filterValue.match(/(?<digits>\d+)\s*(?<string>\w*)/);

  const userSuppliedAmount = Number(match?.groups?.digits);
  const userSuppliedUnits = (match?.groups?.string ?? '').trim().toLowerCase();

  const userSuppliedAmountIsValid = !isNaN(userSuppliedAmount) && userSuppliedAmount > 0;

  // If there is a number w/o units, show all unit options
  if (userSuppliedAmountIsValid && !userSuppliedUnits) {
    return SUPPORTED_RELATIVE_UNITS_LIST.map((unit, index) =>
      makeItem(userSuppliedAmount, unit, index)
    );
  }

  // If there is a number followed by units, show the matching number/unit option
  if (userSuppliedAmountIsValid && userSuppliedUnits) {
    const matchingUnit = SUPPORTED_RELATIVE_UNITS_LIST.find(unit => {
      if (userSuppliedUnits.length === 1) {
        return unit === userSuppliedUnits;
      }

      return SUPPORTED_RELATIVE_PERIOD_UNITS[unit].searchKey.startsWith(
        userSuppliedUnits
      );
    });

    if (matchingUnit) {
      return [makeItem(userSuppliedAmount, matchingUnit, 0)];
    }
  }

  // Otherwise, do a normal filter search
  return items
    ?.filter(item => item.searchKey.toLowerCase().includes(filterValue.toLowerCase()))
    .map((item, index) => ({...item, index})) as ItemsAfterFilter;
};

export default timeRangeAutoCompleteFilter;
