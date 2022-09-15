import {render} from 'sentry-test/reactTestingLibrary';

import IntervalSelector from 'sentry/components/charts/intervalSelector';
import EventView from 'sentry/utils/discover/eventView';

describe('IntervalSelector', function () {
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [project.id],
  });
  it('increases small interval', function () {
    let interval = '1s';
    eventView.interval = interval;
    eventView.statsPeriod = '90d';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        onIntervalChange={newInterval => (interval = newInterval)}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('4h');
  });
  it('reducing uses clean day shorthands', function () {
    let interval = '2d';
    eventView.interval = interval;
    eventView.statsPeriod = interval;
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        onIntervalChange={newInterval => (interval = newInterval)}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('1d');
  });
  it('reducing uses clean hour shorthands', function () {
    let interval = '2h';
    eventView.interval = interval;
    eventView.statsPeriod = interval;
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        onIntervalChange={newInterval => (interval = newInterval)}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('1h');
  });
  it('reducing uses clean minute shorthands', function () {
    let interval = '1h';
    eventView.interval = interval;
    eventView.statsPeriod = interval;
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        onIntervalChange={newInterval => (interval = newInterval)}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('30m');
  });
  it('leaves default interval alone', function () {
    eventView.interval = undefined;
    eventView.statsPeriod = '90d';
    let interval = 'not called';
    const intervalSelector = (
      <IntervalSelector
        eventView={eventView}
        onIntervalChange={_newInterval => (interval = 'called')}
      />
    );
    render(intervalSelector);
    expect(interval).toEqual('not called');
  });
});
