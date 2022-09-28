import {render} from 'sentry-test/reactTestingLibrary';

import IntervalSelector from 'sentry/components/charts/intervalSelector';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';

describe('IntervalSelector', function () {
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [project.id],
  });
  it('resets small interval', function () {
    let interval = '1s';
    eventView.interval = interval;
    eventView.statsPeriod = '90d';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        displayMode={DisplayModes.DEFAULT}
        onIntervalChange={newInterval => (interval = newInterval)}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('4h');
  });
  it('resets large interval', function () {
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
    expect(eventView.interval).toEqual('1m');
  });
  it('leaves default interval alone', function () {
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
    expect(interval).toEqual('not called');
  });
});
