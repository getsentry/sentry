import * as Amplitude from '@amplitude/analytics-browser';
import * as qs from 'query-string';
import {UserFixture} from 'sentry-fixture/user';

import ConfigStore from 'sentry/stores/configStore';
import sessionStorageWrapper from 'sentry/utils/sessionStorage';

import analyticsInitUser from 'getsentry/hooks/analyticsInitUser';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';

jest.mock('getsentry/utils/trackMarketingEvent');

describe('analyticsInitUser', function () {
  const user = UserFixture({});
  const _identifyInstance = new Amplitude.Identify();

  beforeEach(function () {
    sessionStorageWrapper.clear();
    ConfigStore.set('enableAnalytics', true);
    ConfigStore.set('getsentry.amplitudeApiKey', 'foo');
  });
  afterEach(function () {
    window.location.search = '';
    sessionStorageWrapper.removeItem('marketing_event_recorded');
    (trackMarketingEvent as jest.Mock).mockClear();
    (Amplitude.setUserId as jest.Mock).mockClear();
    (Amplitude.track as jest.Mock).mockClear();
    (Amplitude.Identify as jest.Mock).mockClear();
  });
  it('calls getInstance and initializes with user and user properties', function () {
    analyticsInitUser(user);
    expect(Amplitude.Identify).toHaveBeenCalledWith();
    expect(_identifyInstance.set).toHaveBeenCalledWith('user_id', user.id);
    expect(_identifyInstance.set).toHaveBeenCalledWith('isInternalUser', false);
  });
  it('calls user properties and sets isInternalUser with organization', function () {
    const internalUser = UserFixture({});
    internalUser.isSuperuser = false;
    internalUser.identities = [{organization: {slug: 'sentry'}}];
    const oldConfig = ConfigStore.getState();
    ConfigStore.set('user', internalUser);
    analyticsInitUser(internalUser);
    expect(Amplitude.Identify).toHaveBeenCalledWith();
    expect(_identifyInstance.set).toHaveBeenCalledWith('user_id', user.id);
    expect(_identifyInstance.set).toHaveBeenCalledWith('isInternalUser', true);
    ConfigStore.set('user', oldConfig.user);
  });
  it('calls user properties and sets isInternalUser with email', function () {
    const internalUser = UserFixture({});
    internalUser.isSuperuser = false;
    internalUser.identities = [];
    internalUser.emails = [{email: 'you@sentry.io', is_verified: true, id: '273025'}];
    const oldConfig = ConfigStore.getState();
    ConfigStore.set('user', internalUser);
    analyticsInitUser(internalUser);
    expect(Amplitude.Identify).toHaveBeenCalledWith();
    expect(_identifyInstance.set).toHaveBeenCalledWith('user_id', user.id);
    expect(_identifyInstance.set).toHaveBeenCalledWith('isInternalUser', true);
    ConfigStore.set('user', oldConfig.user);
  });
  it('handles frontend_events as array', function () {
    const events = [
      {event_name: 'Sign Up', event_label: 'Google'},
      {event_name: 'Start Trial'},
    ];
    const jsonEvents = JSON.stringify(events);
    window.location.search = qs.stringify({frontend_events: jsonEvents});
    analyticsInitUser(user);
    expect(trackMarketingEvent).toHaveBeenCalledWith('Sign Up', {event_label: 'Google'});
    expect(trackMarketingEvent).toHaveBeenCalledWith('Start Trial', {
      event_label: undefined,
    });
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('handles frontend_events as single event', function () {
    const events = {event_name: 'Sign Up', event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    window.location.search = qs.stringify({frontend_events: jsonEvents});
    analyticsInitUser(user);
    expect(trackMarketingEvent).toHaveBeenCalledWith('Sign Up', {event_label: 'Google'});
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('skip sending event if in session storage', function () {
    const events = {event_name: 'Sign Up', event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    window.location.search = qs.stringify({frontend_events: jsonEvents});
    sessionStorageWrapper.setItem('marketing_event_recorded', jsonEvents);
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
  });
  it('handles malformed event_name', function () {
    const events = {event_name: undefined, event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    window.location.search = qs.stringify({frontend_events: jsonEvents});
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
  });
  it('store previous_referrer in local storage', function () {
    window.location.search = qs.stringify({referrer: 'something'});
    // We need to spy on the prototype since this may not be a mocked class
    // https://stackoverflow.com/questions/32911630/how-do-i-deal-with-localstorage-in-jest-tests
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    analyticsInitUser(user);
    expect(spy).toHaveBeenCalledWith('previous_referrer', 'something');
  });
  it('analytics disabled', function () {
    ConfigStore.set('enableAnalytics', false);
    analyticsInitUser(user);
    expect(Amplitude.Identify).not.toHaveBeenCalledWith();
  });
});
