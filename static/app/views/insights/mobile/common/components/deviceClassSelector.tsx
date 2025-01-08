import type {ComponentProps} from 'react';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {ModuleName} from 'sentry/views/insights/types';

interface Props {
  clearSpansTableCursor?: boolean;
  moduleName?: ModuleName;
  size?: ComponentProps<typeof CompactSelect>['size'];
}

export function DeviceClassSelector({
  size = 'xs',
  clearSpansTableCursor,
  moduleName = ModuleName.OTHER,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

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
        if (moduleName === ModuleName.APP_START) {
          trackAnalytics('insight.app_start.spans.filter_by_device_class', {
            organization,
            filter: newValue.value,
          });
        } else if (moduleName === ModuleName.SCREEN_LOAD) {
          trackAnalytics('insight.screen_load.spans.filter_by_device_class', {
            organization,
            filter: newValue.value,
          });
        }
        navigate({
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
