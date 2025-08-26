import * as Amplitude from '@amplitude/analytics-browser';
import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import ConfigStore from 'sentry/stores/configStore';

import trackAmplitudeEvent from 'getsentry/utils/trackAmplitudeEvent';

jest.unmock('getsentry/utils/trackAmplitudeEvent');

describe('trackAmplitudeEvent', () => {
  const user = UserFixture({});
  const data = {foo: 'bar'};
  const eventName = 'My Event';
  const orgId = 123;
  beforeEach(() => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        enableAnalytics: true,
        user,
      })
    );
  });
  afterEach(() => {
    (Amplitude.setUserId as jest.Mock).mockClear();
    (Amplitude.track as jest.Mock).mockClear();
    (Amplitude.setGroup as jest.Mock).mockClear();
  });

  it('organization id is a number calls track', () => {
    trackAmplitudeEvent(eventName, orgId, data);
    expect(Amplitude.setUserId).toHaveBeenCalledWith(user.id);
    expect(Amplitude.track).toHaveBeenCalledWith(eventName, data, undefined);
    expect(Amplitude.setGroup).toHaveBeenCalledWith('organization_id', orgId.toString());
  });
  it('two track calls only call setGroup once', () => {
    trackAmplitudeEvent(eventName, 454, data);
    trackAmplitudeEvent(eventName, 454, data);
    expect(Amplitude.track).toHaveBeenCalledTimes(2);
    expect(Amplitude.setGroup).toHaveBeenCalledTimes(1);
  });
  it('organization id is null calls track', () => {
    trackAmplitudeEvent(eventName, null, data);
    expect(Amplitude.track).toHaveBeenCalledWith(eventName, data, undefined);
    expect(Amplitude.setGroup).toHaveBeenCalledWith('organization_id', '');
  });
  it('organization id is undefined does not call track', () => {
    trackAmplitudeEvent(eventName, undefined, data);
    expect(Amplitude.track).not.toHaveBeenCalled();
  });
  it('enableAnalytics is false', () => {
    ConfigStore.set('enableAnalytics', false);
    trackAmplitudeEvent(eventName, orgId, data);
    expect(Amplitude.track).not.toHaveBeenCalled();
  });
});
