import {useState} from 'react';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {t} from 'sentry/locale';
import {
  getSharedDeviceType,
  type DeviceType,
} from 'sentry/views/insights/browser/webVitals/utils/deviceType';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';

/**
 * Picks the device type the panel shows. When the browser filter only has one
 * device type, that type wins and there's nothing to choose.
 */
export function useDeviceType(browserTypes: BrowserType[]) {
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType>('desktop');
  const sharedDeviceType = getSharedDeviceType(browserTypes);

  return {
    deviceType: sharedDeviceType ?? selectedDeviceType,
    setDeviceType: setSelectedDeviceType,
    canSelectDeviceType: sharedDeviceType === undefined,
  };
}

export function DeviceTypeSelector({
  value,
  onChange,
}: {
  onChange: (value: DeviceType) => void;
  value: DeviceType;
}) {
  return (
    <SegmentedControl<DeviceType>
      aria-label={t('Device type')}
      size="xs"
      value={value}
      onChange={onChange}
    >
      <SegmentedControl.Item key="desktop">{t('Desktop')}</SegmentedControl.Item>
      <SegmentedControl.Item key="mobile">{t('Mobile')}</SegmentedControl.Item>
    </SegmentedControl>
  );
}
