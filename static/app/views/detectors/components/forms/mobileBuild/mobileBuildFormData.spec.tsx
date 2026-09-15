import {PreprodDetectorFixture} from 'sentry-fixture/detectors';

import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';

import {
  preprodFormDataToEndpointPayload,
  preprodSavedDetectorToFormData,
} from './mobileBuildFormData';

describe('mobile build detector payloads', () => {
  it.each(['absolute', 'absolute_diff', 'relative_diff'] as const)(
    'round trips zero and fractional thresholds for %s',
    thresholdType => {
      const defaults = preprodSavedDetectorToFormData(PreprodDetectorFixture());
      const values = {
        ...defaults,
        thresholdType,
        highThreshold: '0',
        lowThreshold: '1.25',
      };
      const payload = preprodFormDataToEndpointPayload(values);
      expect(payload.conditionGroup.conditions).toEqual([
        expect.objectContaining({
          comparison: 0,
          conditionResult: DetectorPriorityLevel.HIGH,
        }),
        expect.objectContaining({
          comparison: thresholdType === 'relative_diff' ? 1.25 : 1250000,
          conditionResult: DetectorPriorityLevel.LOW,
        }),
      ]);
      expect(
        preprodSavedDetectorToFormData(
          PreprodDetectorFixture({
            ...payload,
            owner: null,
            conditionGroup: {
              ...payload.conditionGroup,
              id: '1',
              conditions: payload.conditionGroup.conditions.map((condition, index) => ({
                ...condition,
                id: String(index + 1),
              })),
            },
          })
        )
      ).toEqual(values);
    }
  );

  it.each([
    ['2', '', DetectorPriorityLevel.HIGH],
    ['', '2', DetectorPriorityLevel.LOW],
  ] as const)(
    'serializes a single threshold (%s, %s)',
    (highThreshold, lowThreshold, priority) => {
      const values = {
        ...preprodSavedDetectorToFormData(PreprodDetectorFixture()),
        highThreshold,
        lowThreshold,
        query: '',
        owner: '',
        description: '',
      };
      const payload = preprodFormDataToEndpointPayload(values);
      expect(payload.conditionGroup.conditions).toHaveLength(1);
      expect(payload.conditionGroup.conditions[0]).toEqual(
        expect.objectContaining({conditionResult: priority})
      );
      expect(payload).toEqual(expect.objectContaining({owner: null, description: null}));
      expect(payload.config.query).toBeUndefined();
    }
  );
});
