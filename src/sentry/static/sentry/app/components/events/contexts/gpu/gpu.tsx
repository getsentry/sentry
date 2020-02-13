import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import getOperatingSystemKnownData, {
  GPUData,
  GPUKnownDataDetailsType,
} from './getGPUKnownData';

type Props = {
  data?: GPUData;
};

const KNOWN_DATA = [
  GPUKnownDataDetailsType.NAME,
  GPUKnownDataDetailsType.VERSION,
  GPUKnownDataDetailsType.VENDOR_NAME,
  GPUKnownDataDetailsType.MEMORY,
  GPUKnownDataDetailsType.NPOT_SUPPORT,
  GPUKnownDataDetailsType.MULTI_THREAD_RENDERING,
  GPUKnownDataDetailsType.API_TYPE,
];

const GPU = ({data}: Props) => {
  if (data === undefined || data === null) {
    return null;
  }

  if (data.vendor_id > 0) {
    KNOWN_DATA.unshift[GPUKnownDataDetailsType.VENDOR_ID];
  }
  if (data.id > 0) {
    KNOWN_DATA.unshift[GPUKnownDataDetailsType.ID];
  }

  return <ContextBlock knownData={getOperatingSystemKnownData(data, KNOWN_DATA)} />;
};

GPU.getTitle = () => 'GPU';

export default GPU;
