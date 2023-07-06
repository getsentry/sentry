import {stackMarkerToHumanReadable} from 'sentry/domains/profiling/utils/formatters/stackMarkerToHumanReadable';

describe('stackMarkerToHumanReadable', () => {
  it('gracefully handles unknown input', () => {
    expect(stackMarkerToHumanReadable('boop' as JSSelfProfiling.Marker)).toBe('boop');
  });
  it('gc', () => {
    expect(stackMarkerToHumanReadable('gc')).toBe('Garbage Collection');
  });
});
