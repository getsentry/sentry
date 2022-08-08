import {gpuKnownDataValues} from 'sentry/components/events/contexts/gpu';
import {getGPUKnownData} from 'sentry/components/events/contexts/gpu/getGPUKnownData';

import {gpuMetaMockData, gpuMockData} from './index.spec';

describe('getGPUKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const gpuKnownData = getGPUKnownData({
      data: gpuMockData,
      meta: gpuMetaMockData,
      gpuKnownDataValues,
    });

    expect(gpuKnownData).toEqual([
      {
        key: 'name',
        subject: 'Name',
        value: '',
        meta: gpuMetaMockData.name[''],
      },
      {
        key: 'version',
        subject: 'Version',
        value: 'Metal',
        meta: undefined,
      },
      {
        key: 'vendor_name',
        subject: 'Vendor Name',
        value: 'Apple',
      },
      {
        key: 'npot_support',
        subject: 'NPOT Support',
        value: 'Full',
        meta: undefined,
      },
      {
        key: 'multi_threaded_rendering',
        subject: 'Multi-Thread rendering',
        value: true,
        meta: undefined,
      },
      {
        key: 'api_type',
        subject: 'API Type',
        value: '',
        meta: gpuMetaMockData.api_type[''],
      },
    ]);
  });
});
