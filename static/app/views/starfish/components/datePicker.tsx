import DatePageFilter from 'sentry/components/datePageFilter';
import {t} from 'sentry/locale';

function StarfishDatePicker() {
  return (
    <DatePageFilter
      maxDateRange={1}
      disallowArbitraryRelativeRanges
      relativeOptions={{'1h': t('1h'), '6h': t('6h'), '12h': t('12h'), '24h': t('24h')}}
      alignDropdown="left"
    />
  );
}

export default StarfishDatePicker;
