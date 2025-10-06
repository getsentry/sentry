import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  useIncidentMarkers,
  type IncidentPeriod,
} from 'sentry/views/detectors/hooks/useIncidentMarkers';

describe('useIncidentMarkers', () => {
  const incident: IncidentPeriod = {
    id: 'incident-1',
    name: 'Test Incident',
    color: '#ff0000',
    type: 'test',
    start: 10_000,
    end: 10_000 + 60_000, // ms
  };
  const intervalMs = 60_000; // 1 minute

  describe('includePreviousIntervalMarker', () => {
    it('omits trigger-interval marker when includePreviousIntervalMarker is false', () => {
      const {result} = renderHookWithProviders(() =>
        useIncidentMarkers({
          incidents: [incident],
          seriesName: 'Incidents',
          intervalMs,
          includePreviousIntervalMarker: false,
        })
      );

      // Just a single open period marker
      const series = result.current.incidentMarkerSeries;
      expect(series).not.toBeNull();
      expect(series!.data).toHaveLength(1);
    });

    it('adds trigger-interval marker when includePreviousIntervalMarker is true', () => {
      const {result} = renderHookWithProviders(() =>
        useIncidentMarkers({
          incidents: [incident],
          seriesName: 'Incidents',
          intervalMs,
          includePreviousIntervalMarker: true,
        })
      );

      const series = result.current.incidentMarkerSeries;
      const data = series!.data as IncidentPeriod[];
      expect(data).toHaveLength(2);

      const triggerInterval = data[0];
      const openPeriod = data[1];

      expect(triggerInterval).toEqual(
        expect.objectContaining({
          color: incident.color,
          // Should start 1 interval before the incident and end at the start of the incident
          start: incident.start - intervalMs,
          end: incident.start,
        })
      );

      expect(openPeriod).toEqual(
        expect.objectContaining({
          color: incident.color,
          start: incident.start,
          end: incident.end,
        })
      );
    });
  });
});
