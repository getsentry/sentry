import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import getDeviceKnownData, {DeviceData} from './getDeviceKnownData';

type Props = {
  data?: DeviceData;
};

const Device = ({data}: Props) => {
  if (data === undefined || data === null) {
    return null;
  }

  return <ContextBlock knownData={getDeviceKnownData(data)} />;
};

Device.getTitle = () => 'Device';

export default Device;
