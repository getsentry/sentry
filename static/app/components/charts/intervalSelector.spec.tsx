import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import IntervalSelector from 'sentry/components/charts/intervalSelector';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';

describe('IntervalSelector', () => {
  const project = ProjectFixture();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [parseInt(project.id, 10)],
  });
  it('resets small interval', async () => {
    let interval: string | undefined = '1s';
    eventView.interval = interval;
    eventView.statsPeriod = '90d';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        displayMode={DisplayModes.DEFAULT}
        onIntervalChange={newInterval => {
          interval = newInterval;
        }}
      />
    );
    render(intervalSelector);

    await waitFor(() => {
      expect(screen.getByText('Interval')).toBeInTheDocument();
    });

    expect(interval).toBe('4h');
  });
  it('resets large interval', async () => {
    eventView.interval = '1h';
    eventView.statsPeriod = '1h';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        displayMode={DisplayModes.DEFAULT}
        onIntervalChange={newInterval => (eventView.interval = newInterval)}
      />
    );
    render(intervalSelector);

    await waitFor(() => {
      expect(screen.getByText('Interval')).toBeInTheDocument();
    });

    expect(eventView.interval).toBe('1m');
  });
  it('leaves default interval alone', async () => {
    eventView.interval = undefined;
    eventView.statsPeriod = '90d';
    let interval = 'not called';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        displayMode={DisplayModes.DEFAULT}
        onIntervalChange={_newInterval => (interval = 'called')}
      />
    );
    render(intervalSelector);

    await waitFor(() => {
      expect(screen.getByText('Interval')).toBeInTheDocument();
    });

    expect(interval).toBe('not called');
  });
});
