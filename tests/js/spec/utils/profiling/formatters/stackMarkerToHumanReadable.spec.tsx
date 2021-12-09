import {stackMarkerToHumanReadable} from 'sentry/utils/profiling/formatters/stackMarkerToHumanReadable';

describe('stackMarkerToHumanReadable', () => {
  it('gracefully handles unknown input', () => {
    expect(stackMarkerToHumanReadable('boop' as JSSelfProfiling.Marker)).toBe('boop');
  });
  it('gc', () => {
    expect(stackMarkerToHumanReadable('gc')).toBe('Garbage Collection');
  });
});
