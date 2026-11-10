import * as Amplitude from '@amplitude/analytics-browser';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';
import {UserFixture} from 'sentry-fixture/user';

import {setWindowLocation} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {analyticsInitUser} from 'getsentry/overrides/analyticsInitUser';
import {trackMarketingEvent} from 'getsentry/utils/trackMarketingEvent';

jest.mock('getsentry/utils/trackMarketingEvent');

describe('analyticsInitUser', () => {
  const user = UserFixture({});
  const _identifyInstance = new Amplitude.Identify();

  beforeEach(() => {
    sessionStorageWrapper.clear();
    ConfigStore.set('enableAnalytics', true);
    ConfigStore.set('getsentry.amplitudeApiKey', 'foo');
    setWindowLocation('http:/localhost/');
  });
  afterEach(() => {
    sessionStorageWrapper.removeItem('marketing_event_recorded');
    jest.mocked(trackMarketingEvent).mockClear();
    jest.restoreAllMocks();
    jest.mocked(Amplitude.setUserId).mockClear();
    jest.mocked(Amplitude.track).mockClear();
    jest.mocked(Amplitude.Identify).mockClear();
  });
  it('calls getInstance and initializes with user and user properties', () => {
    analyticsInitUser(user);
    expect(Amplitude.Identify).toHaveBeenCalledWith();
    expect(_identifyInstance.set).toHaveBeenCalledWith('user_id', user.id);
    expect(_identifyInstance.set).toHaveBeenCalledWith('isInternalUser', false);
  });
  it('calls user properties and sets isInternalUser with organization', () => {
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
  it('calls user properties and sets isInternalUser with email', () => {
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
  it('handles frontend_events as array', () => {
    const events = [
      {event_name: 'Sign Up', event_label: 'Google'},
      {event_name: 'Start Trial'},
    ];
    const jsonEvents = JSON.stringify(events);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    analyticsInitUser(user);
    expect(trackMarketingEvent).toHaveBeenCalledWith('Sign Up', {event_label: 'Google'});
    expect(trackMarketingEvent).toHaveBeenCalledWith('Start Trial', {
      event_label: undefined,
    });
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('handles frontend_events as single event', () => {
    const events = {event_name: 'Sign Up', event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    analyticsInitUser(user);
    expect(trackMarketingEvent).toHaveBeenCalledWith('Sign Up', {event_label: 'Google'});
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('skip sending event if in session storage', () => {
    const events = {event_name: 'Sign Up', event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    sessionStorageWrapper.setItem('marketing_event_recorded', jsonEvents);
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
  });
  it('handles malformed event_name', () => {
    const events = {event_name: undefined, event_label: 'Google'};
    const jsonEvents = JSON.stringify(events);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
  });
  it('tracks the valid events and warns about each invalid one', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const events = [
      {event_name: 'Sign Up', event_label: 'github', extra: true},
      {event_name: ''},
      {event_name: 7},
      {event_label: 'Google'},
      {event_name: 'Bad Label', event_label: null},
      {event_name: 'Bad Label', event_label: 3},
      null,
      'Sign Up',
      {event_name: 'Start Trial'},
    ];
    const jsonEvents = JSON.stringify(events);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    analyticsInitUser(user);
    expect(jest.mocked(trackMarketingEvent).mock.calls).toEqual([
      ['Sign Up', {event_label: 'github'}],
      ['Start Trial', {event_label: undefined}],
    ]);
    expect(warn).toHaveBeenCalledTimes(7);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('warns without reporting to Sentry when frontend_events is null', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setWindowLocation('http://localhost/?frontend_events=null');
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toBe('null');
  });
  it('reports invalid frontend_events JSON and still records it in session storage', () => {
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: '[{'})}`);
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      new Error('Invalid frontend_events JSON')
    );
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toBe('[{');
  });
  it('reports a tracking error and still records frontend_events in session storage', () => {
    const error = new Error('ga is not a function');
    jest.mocked(trackMarketingEvent).mockImplementationOnce(() => {
      throw error;
    });
    const jsonEvents = JSON.stringify([{event_name: 'Sign Up'}]);
    setWindowLocation(`http://localhost/?${qs.stringify({frontend_events: jsonEvents})}`);
    analyticsInitUser(user);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toEqual(jsonEvents);
  });
  it('ignores frontend_events when it is repeated', () => {
    setWindowLocation(
      'http://localhost/?frontend_events=%7B%22event_name%22%3A%22A%22%7D&frontend_events=%7B%22event_name%22%3A%22B%22%7D'
    );
    analyticsInitUser(user);
    expect(trackMarketingEvent).not.toHaveBeenCalled();
    expect(sessionStorageWrapper.getItem('marketing_event_recorded')).toBeNull();
  });
  it('store previous_referrer in local storage', () => {
    setWindowLocation('http:/localhost/?referrer=something');
    // We need to spy on the prototype since this may not be a mocked class
    // https://stackoverflow.com/questions/32911630/how-do-i-deal-with-localstorage-in-jest-tests
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    analyticsInitUser(user);
    expect(spy).toHaveBeenCalledWith('previous_referrer', 'something');
  });
  it('analytics disabled', () => {
    ConfigStore.set('enableAnalytics', false);
    analyticsInitUser(user);
    expect(Amplitude.Identify).not.toHaveBeenCalledWith();
  });
});
