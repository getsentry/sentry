import {gpuKnownDataValues} from 'sentry/components/events/contexts/gpu';
import {getGPUKnownDataDetails} from 'sentry/components/events/contexts/gpu/getGPUKnownDataDetails';

import {gpuMockData} from './index.spec';

describe('getGPUKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getGPUKnownDataDetails>[] = [];

    for (const type of Object.keys(gpuKnownDataValues)) {
      const knownDataValues = getGPUKnownDataDetails({
        type: gpuKnownDataValues[type],
        data: gpuMockData,
      });

      if (!knownDataValues) {
        continue;
      }

      allKnownData.push(knownDataValues);
    }

    expect(allKnownData).toEqual([
      {subject: 'Name', value: ''},
      {subject: 'Version', value: 'Metal'},
      {subject: 'Vendor Name', value: 'Apple'},
      {subject: 'Memory', value: '4.0 GiB'},
      {subject: 'NPOT Support', value: 'Full'},
      {subject: 'Multi-Thread rendering', value: true},
      {subject: 'API Type', value: ''},
    ]);
  });
});
