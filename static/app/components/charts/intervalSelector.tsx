import {getInterval} from 'sentry/components/charts/utils';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import autoCompleteFilter from 'sentry/components/dropdownAutoComplete/autoCompleteFilter';
import DropdownButton from 'sentry/components/dropdownButton';
import {_timeRangeAutoCompleteFilter} from 'sentry/components/organizations/timeRangeSelector/utils';
import {t, tn} from 'sentry/locale';
import {parsePeriodToHours} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';

type IntervalUnits = 's' | 'm' | 'h' | 'd';

type RelativeUnitsMapping = {
  [unit in IntervalUnits]: {
    label: (num: number) => string;
    momentUnit: moment.unitOfTime.DurationConstructor;
    searchKey: string;
  };
};

const SUPPORTED_RELATIVE_PERIOD_UNITS: RelativeUnitsMapping = {
  s: {
    label: (num: number) => tn('Second', '%s seconds', num),
    searchKey: t('seconds'),
    momentUnit: 'seconds',
  },
  m: {
    label: (num: number) => tn('Minute', '%s minutes', num),
    searchKey: t('minutes'),
    momentUnit: 'minutes',
  },
  h: {
    label: (num: number) => tn('Hour', '%s hours', num),
    searchKey: t('hours'),
    momentUnit: 'hours',
  },
  d: {
    label: (num: number) => tn('Day', '%s days', num),
    searchKey: t('days'),
    momentUnit: 'days',
  },
};

const SUPPORTED_RELATIVE_UNITS_LIST = Object.keys(
  SUPPORTED_RELATIVE_PERIOD_UNITS
) as IntervalUnits[];

type Props = {
  eventView: EventView;
  onIntervalChange: (value: string) => void;
};

type IntervalOption = {
  default: string; // The default interval if we go out of bounds
  min: number; // The smallest allowed interval in hours, max is implicitly 1/2 of the time range
  options: string[]; // The dropdown options
  rangeStart: number; // The minimum bound of the time range in hours, options should be in order largest to smallest
};

const INTERVAL_OPTIONS: IntervalOption[] = [
  {
    rangeStart: 90 * 24,
    min: 1,
    default: '4h',
    options: ['1h', '4h', '1d', '5d'],
  },
  {
    rangeStart: 30 * 24,
    min: 0.5,
    default: '1h',
    options: ['30m', '1h', '4h', '1d', '5d'],
  },
  {
    rangeStart: 14 * 24,
    min: 1 / 6,
    default: '30m',
    options: ['30m', '1h', '4h', '1d'],
  },
  {
    rangeStart: 7 * 24,
    min: 1 / 20,
    default: '30m',
    options: ['30m', '1h', '4h', '1d'],
  },
  {
    rangeStart: 1 * 24, // 1 day
    min: 1 / 60,
    default: '5m',
    options: ['5m', '15m', '1h'],
  },
  {
    rangeStart: 1, // 1 hour
    min: 1 / 3600,
    default: '1m',
    options: ['1m', '5m', '15m'],
  },
  {
    rangeStart: 1 / 60, // 1 minute
    min: 1 / 3600,
    default: '1s',
    options: ['1s', '5s', '30s'],
  },
];

function getIntervalOption(rangeHours: number): IntervalOption {
  for (const index in INTERVAL_OPTIONS) {
    const currentOption = INTERVAL_OPTIONS[index];
    if (currentOption.rangeStart <= rangeHours) {
      return currentOption;
    }
  }
  return INTERVAL_OPTIONS[0];
}

function bindInterval(
  currentInterval: string,
  rangeHours: number,
  intervalHours: number,
  intervalOption: IntervalOption
): string {
  // If the interval is out of bounds for time range reset it to the default
  // Bounds are either option.min or half the current
  const optionMax = rangeHours / 2;
  let interval = currentInterval;

  if (intervalHours < intervalOption.min) {
    interval = intervalOption.default;
  } else if (intervalHours > optionMax) {
    if (optionMax >= 24) {
      interval = `${optionMax / 24}d`;
    } else if (optionMax >= 1) {
      interval = `${optionMax}h`;
    } else {
      interval = `${optionMax * 60}m`;
    }
  }
  return interval;
}

export default function IntervalSelector({eventView, onIntervalChange}: Props) {
  // Get the interval from the eventView if one was set, otherwise determine what the default is
  // TODO: use the INTERVAL_OPTIONS default instead
  const interval =
    eventView.interval ?? getInterval(eventView.getPageFilters().datetime, 'high');

  const rangeHours = eventView.getDays() * 24;
  const intervalHours = parsePeriodToHours(interval);

  // Determine the applicable interval option
  const intervalOption = getIntervalOption(rangeHours);

  const boundInterval = bindInterval(interval, rangeHours, intervalHours, intervalOption);
  if (boundInterval !== interval) {
    onIntervalChange(boundInterval);
  }

  const intervalAutoComplete: typeof autoCompleteFilter = function (items, filterValue) {
    return _timeRangeAutoCompleteFilter(
      items,
      filterValue,
      SUPPORTED_RELATIVE_PERIOD_UNITS,
      SUPPORTED_RELATIVE_UNITS_LIST
    ).filter(item => {
      const itemHours = parsePeriodToHours(item.value);
      return itemHours >= intervalOption.min && itemHours <= rangeHours / 2;
    });
  };

  return (
    <DropdownAutoComplete
      onSelect={item => onIntervalChange(item.value)}
      items={intervalOption.options.map(option => ({
        value: option,
        searchKey: option,
        label: option,
      }))}
      searchPlaceholder={t('Provide a time interval')}
      autoCompleteFilter={(items, filterValue) =>
        intervalAutoComplete(items, filterValue)
      }
      alignMenu="right"
    >
      {({isOpen}) => (
        <DropdownButton borderless prefix={t('Interval')} isOpen={isOpen}>
          {boundInterval}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  );
}
