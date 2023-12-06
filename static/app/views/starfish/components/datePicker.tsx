import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

function StarfishDatePicker() {
  const organization = useOrganization();
  return (
    <DatePageFilter
      defaultPeriod="24h"
      storageNamespace="starfish"
      onChange={({start, end, relative}) => {
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
