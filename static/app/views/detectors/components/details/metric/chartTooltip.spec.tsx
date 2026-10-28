import {ThemeFixture} from 'sentry-fixture/theme';

import {
  incidentMarklineTooltip,
  incidentSeriesTooltip,
} from 'sentry/views/detectors/components/details/metric/chartTooltip';
import type {IncidentPeriod} from 'sentry/views/detectors/hooks/useIncidentMarkers';

const theme = ThemeFixture();

const INTERVAL_MS = 60_000;

const triggerInterval: IncidentPeriod = {
  id: '1',
  type: 'trigger-interval',
  priority: 'high',
  start: 0,
  end: INTERVAL_MS,
  issueShortId: 'PROJECT-1A',
};

const openPeriod: IncidentPeriod = {
  id: '1',
  type: 'open-period-start',
  priority: 'medium',
  start: INTERVAL_MS,
  end: 5 * INTERVAL_MS,
  issueShortId: 'PROJECT-1A',
};

describe('incidentSeriesTooltip', () => {
  it('describes the trigger interval', () => {
    const tooltip = incidentSeriesTooltip({period: triggerInterval, theme});

    expect(tooltip).toContain('Threshold breached');

    expect(tooltip).toContain('Interval');

    expect(tooltip).toContain('High');

    expect(tooltip).toContain('Click to open PROJECT-1A');
  });

  it('describes the open period', () => {
    const tooltip = incidentSeriesTooltip({period: openPeriod, theme});

    expect(tooltip).toContain('Issue open');

    expect(tooltip).toContain('From');

    expect(tooltip).toContain('To');

    expect(tooltip).toContain('Medium');

    expect(tooltip).toContain('Click to open PROJECT-1A');
  });

  it('shows an ongoing open period as ongoing', () => {
    const tooltip = incidentSeriesTooltip({
      period: {...openPeriod, isOngoing: true},
      theme,
    });

    expect(tooltip).toContain('Ongoing');
  });
});

describe('incidentMarklineTooltip', () => {
  it('describes when the issue opened', () => {
    const tooltip = incidentMarklineTooltip({period: openPeriod, theme});

    expect(tooltip).toContain('Opened issue');

    expect(tooltip).toContain('Started');

    expect(tooltip).toContain('Medium');

    expect(tooltip).toContain('Click to open PROJECT-1A');
  });
});
