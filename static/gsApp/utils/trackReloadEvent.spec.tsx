import ConfigStore from 'sentry/stores/configStore';

import trackReloadEvent from 'getsentry/utils/trackReloadEvent';

jest.unmock('getsentry/utils/trackReloadEvent');

describe('trackReloadEvent', function () {
  const eventName = 'my_event';
  const data = {foo: 'bar'};
  beforeEach(function () {
    ConfigStore.set('enableAnalytics', true);
    window.ra = {event: jest.fn()};
  });
  afterEach(function () {
    window.ra.event.mockClear();
  });

  it('calls window.ra.event with data', function () {
    trackReloadEvent(eventName, data);
    expect(window.ra.event).toHaveBeenCalledWith(eventName, data);
  });
  it('enableAnalytics is false', function () {
    ConfigStore.set('enableAnalytics', false);
    trackReloadEvent(eventName, data);
    expect(window.ra.event).not.toHaveBeenCalled();
  });
});
