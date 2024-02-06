import type {ComponentProps} from 'react';
import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';

interface Props {
  clearSpansTableCursor?: boolean;
  size?: ComponentProps<typeof CompactSelect>['size'];
}

export function DeviceClassSelector({size = 'xs', clearSpansTableCursor}: Props) {
  const location = useLocation();

  const value = decodeScalar(location.query['device.class']) ?? '';

  const options = [
    {value: '', label: t('All')},
    {value: 'high', label: t('High')},
    {value: 'medium', label: t('Medium')},
    {value: 'low', label: t('Low')},
    {value: 'Unknown', label: t('Unknown')},
  ];

  return (
    <CompactSelect
      size={size}
      triggerProps={{prefix: t('Device Class')}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            ['device.class']: newValue.value,
            [MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE]: undefined,
            [MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE]: undefined,
            ...(clearSpansTableCursor ? {[MobileCursors.SPANS_TABLE]: undefined} : {}),
          },
        });
      }}
    />
  );
}
