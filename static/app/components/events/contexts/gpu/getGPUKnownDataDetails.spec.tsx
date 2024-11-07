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
      {subject: 'GPU ID', value: 2400},
      {subject: 'Vendor ID', value: '2400.0.0'},
      {subject: 'Vendor Name', value: 'Apple'},
      {subject: 'Memory', value: '4.0 GiB'},
      {subject: 'API Type', value: ''},
      {subject: 'Multi-Thread Rendering', value: true},
      {subject: 'NPOT Support', value: 'Full'},
      {subject: 'Max Texture Size', value: 16384},
      {subject: 'Approx. Shader Capability', value: 'OpenGL ES 3.0'},
      {subject: 'Supports Draw Call Instancing', value: true},
      {subject: 'Supports Ray Tracing', value: true},
      {subject: 'Supports Compute Shaders', value: true},
      {subject: 'Supports Geometry Shaders', value: true},
    ]);
  });
});
