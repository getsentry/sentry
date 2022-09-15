import {getInterval} from 'sentry/components/charts/utils';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';
import {parsePeriodToHours} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';

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
    options: ['30m', '1h', '4h', '1d', '5d'],
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
  } else if (intervalHours > optionMax * 24) {
    if (optionMax > 1) {
      interval = `${optionMax}d`;
    } else if (optionMax > 1 / 24) {
      interval = `${optionMax / 24}h`;
    } else {
      interval = `${optionMax / 24 / 60}m`;
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

  return (
    <DropdownAutoComplete
      onSelect={item => onIntervalChange(item.value)}
      items={intervalOption.options.map(option => ({
        value: option,
        searchKey: option,
        label: option,
      }))}
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
