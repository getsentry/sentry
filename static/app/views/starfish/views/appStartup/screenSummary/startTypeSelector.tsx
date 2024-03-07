import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';

export const COLD_START_TYPE = 'cold';
export const WARM_START_TYPE = 'warm';

export function StartTypeSelector() {
  const location = useLocation();

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
        browserHistory.push({
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
