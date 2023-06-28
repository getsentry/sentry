import DatePageFilter from 'sentry/components/datePageFilter';
import {t} from 'sentry/locale';
import {MAXIMUM_DATE_RANGE} from 'sentry/views/starfish/components/pageFilterContainer';

function StarfishDatePicker() {
  return (
    <DatePageFilter
      maxDateRange={MAXIMUM_DATE_RANGE}
      disallowArbitraryRelativeRanges
      relativeOptions={{
        '1h': t('Last hour'),
        '12h': t('Last 12 hours'),
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
