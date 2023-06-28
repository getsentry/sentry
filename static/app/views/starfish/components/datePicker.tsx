import DatePageFilter from 'sentry/components/datePageFilter';
import {t} from 'sentry/locale';

function StarfishDatePicker() {
  return (
    <DatePageFilter
      maxDateRange={7}
      disallowArbitraryRelativeRanges
      relativeOptions={{
        '1h': t('Last hour'),
        '12h': t('Last 6 hours'),
        '24h': t('Last 24 hours'),
        '3d': t('Last 3 days'),
        '7d': t('Last 7 days'),
      }}
      defaultPeriod="24h"
      alignDropdown="left"
    />
  );
}

export default StarfishDatePicker;
