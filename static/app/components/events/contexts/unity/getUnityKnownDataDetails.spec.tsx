import {
  getUnityKnownDataDetails,
  unityKnownDataValues,
} from 'sentry/components/events/contexts/unity/getUnityKnownDataDetails';

import {unityMockData} from './index.spec';

describe('getUnityKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getUnityKnownDataDetails>[] = [];

    for (const type of Object.keys(unityKnownDataValues)) {
      const threadPoolInfoKnownData = getUnityKnownDataDetails({
        type: unityKnownDataValues[type],
        data: unityMockData,
      });

      if (!threadPoolInfoKnownData) {
        continue;
      }

      allKnownData.push(threadPoolInfoKnownData);
    }

    expect(allKnownData).toEqual([
      {
        subject: 'Copy Texture Support',
        value: 'Basic, Copy3D, DifferentTypes, TextureToRT, RTToTexture',
      },
      {subject: 'Editor Version', value: '2022.1.23f1'},
      {subject: 'Install Mode', value: 'Store'},
      {subject: 'Rendering Threading Mode', value: 'LegacyJobified'},
      {subject: 'Target Frame Rate', value: '-1'},
    ]);
  });
});
