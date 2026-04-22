import {ConfigStore} from 'sentry/stores/configStore';

import {trackMarketingEvent} from 'getsentry/utils/trackMarketingEvent';

jest.unmock('getsentry/utils/trackMarketingEvent');

describe('trackMarketingEvent', () => {
  const eventName = 'my_event';
  beforeEach(() => {
    ConfigStore.set('enableAnalytics', true);
    globalThis.ga = jest.fn();
  });
  afterEach(() => {
    globalThis.ga.mockClear();
  });

  it('calls window.ga with event_label', () => {
    const data = {event_label: 'my_label'};
    trackMarketingEvent(eventName, data);
    expect(globalThis.ga).toHaveBeenCalledWith('send', {
      hitType: 'event',
      eventCategory: 'User',
      eventAction: eventName,
      eventLabel: 'my_label',
    });
  });
  it('calls window.ga without event_label', () => {
    trackMarketingEvent(eventName);
    expect(globalThis.ga).toHaveBeenCalledWith('send', {
      hitType: 'event',
      eventCategory: 'User',
      eventAction: eventName,
      eventLabel: undefined,
    });
  });
  it('enableAnalytics is false', () => {
    ConfigStore.set('enableAnalytics', false);
    trackMarketingEvent(eventName);
    expect(globalThis.ga).not.toHaveBeenCalled();
  });
});
