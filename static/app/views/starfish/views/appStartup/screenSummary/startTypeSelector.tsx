import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';

export function StartTypeSelector() {
  const location = useLocation();

  const value = decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? '';

  const options = [
    {value: '', label: t('All')},
    {value: 'cold', label: t('Cold')},
    {value: 'warm', label: t('Warm')},
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('Start Type')}}
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
