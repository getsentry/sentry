import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const COLD_START_TYPE = 'cold';
export const WARM_START_TYPE = 'warm';

export function StartTypeSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const value =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const options = [
    {value: COLD_START_TYPE, label: t('Cold Start')},
    {value: WARM_START_TYPE, label: t('Warm Start')},
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('App Start')}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        trackAnalytics('insight.app_start.select_start_type', {
          organization,
          type: newValue.value,
        });
        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.APP_START_TYPE]: newValue.value,
            [MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE]: undefined,
            [MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE]: undefined,
            [MobileCursors.SPANS_TABLE]: undefined,
          },
        });
      }}
    />
  );
}
