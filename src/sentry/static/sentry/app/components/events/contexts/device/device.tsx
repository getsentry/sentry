import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';
import {defined} from 'app/utils';

import {DeviceData} from './types';
import getDeviceKnownData from './getDeviceKnownData';

type Props = {
  data?: DeviceData;
};

const Device = ({data}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock knownData={getDeviceKnownData(data)} />;
};

Device.getTitle = () => 'Device';

export default Device;
