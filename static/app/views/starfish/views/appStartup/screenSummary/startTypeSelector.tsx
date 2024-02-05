import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';

export function StartTypeSelector() {
  const location = useLocation();

  const value = decodeScalar(location.query.app_start_type) ?? '';

  const options = [
    {value: '', label: t('All')},
    {value: 'cold', label: t('Cold')},
    {value: 'warm', label: t('Warm')},
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('Start Type'), size: 'xs'}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            ['app_start_type']: newValue.value,
            [MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE]: undefined,
            [MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE]: undefined,
          },
        });
      }}
    />
  );
}
