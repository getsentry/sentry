import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getOperatingSystemKnownData from './getGPUKnownData';
import {GPUData, GPUKnownDataType} from './types';
import getUnknownData from '../getUnknownData';

type Props = {
  data: GPUData;
};

const gpuKnownDataValues = [
  GPUKnownDataType.NAME,
  GPUKnownDataType.VERSION,
  GPUKnownDataType.VENDOR_NAME,
  GPUKnownDataType.MEMORY,
  GPUKnownDataType.NPOT_SUPPORT,
  GPUKnownDataType.MULTI_THREAD_RENDERING,
  GPUKnownDataType.API_TYPE,
];

const gpuIgnoredDataValues = [];

const GPU = ({data}: Props) => {
  if (data.vendor_id > 0) {
    gpuKnownDataValues.unshift[GPUKnownDataType.VENDOR_ID];
  }
  if (data.id > 0) {
    gpuKnownDataValues.unshift[GPUKnownDataType.ID];
  }

  return (
    <React.Fragment>
      <ContextBlock data={getOperatingSystemKnownData(data, gpuKnownDataValues)} />
      <ContextBlock
        data={getUnknownData(data, [...gpuKnownDataValues, ...gpuIgnoredDataValues])}
      />
    </React.Fragment>
  );
};

export default GPU;
