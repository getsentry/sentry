import DatePageFilter from 'sentry/components/datePageFilter';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {MAXIMUM_DATE_RANGE} from 'sentry/views/starfish/components/pageFilterContainer';

import {setStarfishDateFilterStorage} from '../utils/dateFilterStorage';

function StarfishDatePicker() {
  const organization = useOrganization();

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
      onChange={({start, end, relative, utc}) => {
        setStarfishDateFilterStorage(organization.slug, {
          period: relative,
          start,
          end,
          utc,
        });
        trackAnalytics('starfish.page_filter.data_change', {
          organization,
          start,
          end,
          relative,
        });
      }}
    />
  );
}

export default StarfishDatePicker;
