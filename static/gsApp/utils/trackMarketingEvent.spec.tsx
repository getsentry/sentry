import ConfigStore from 'sentry/stores/configStore';

import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';

jest.unmock('getsentry/utils/trackMarketingEvent');

describe('trackMarketingEvent', function () {
  const eventName = 'my_event';
  beforeEach(function () {
    ConfigStore.set('enableAnalytics', true);
    window.ga = jest.fn();
  });
  afterEach(function () {
    window.ga.mockClear();
  });

  it('calls window.ga with event_label', function () {
    const data = {event_label: 'my_label'};
    trackMarketingEvent(eventName, data);
    expect(window.ga).toHaveBeenCalledWith('send', {
      hitType: 'event',
      eventCategory: 'User',
      eventAction: eventName,
      eventLabel: 'my_label',
    });
  });
  it('calls window.ga without event_label', function () {
    trackMarketingEvent(eventName);
    expect(window.ga).toHaveBeenCalledWith('send', {
      hitType: 'event',
      eventCategory: 'User',
      eventAction: eventName,
      eventLabel: undefined,
    });
  });
  it('enableAnalytics is false', function () {
    ConfigStore.set('enableAnalytics', false);
    trackMarketingEvent(eventName);
    expect(window.ga).not.toHaveBeenCalled();
  });
});
