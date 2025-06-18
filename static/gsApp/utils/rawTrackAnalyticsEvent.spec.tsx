import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import ConfigStore from 'sentry/stores/configStore';
import {uniqueId} from 'sentry/utils/guid';
import sessionStorage from 'sentry/utils/sessionStorage';

import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';
import trackAmplitudeEvent from 'getsentry/utils/trackAmplitudeEvent';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';
import trackReloadEvent from 'getsentry/utils/trackReloadEvent';

jest.mock('sentry/utils/guid');
jest.mock('getsentry/utils/trackAmplitudeEvent');
jest.mock('getsentry/utils/trackReloadEvent');
jest.mock('getsentry/utils/trackMarketingEvent');

describe('rawTrackAnalyticsEvent', function () {
  const user = ConfigStore.get('user');
  const organization = OrganizationFixture({orgRole: 'owner'});
  const subscription = SubscriptionFixture({organization, plan: 'am1_f'});
  const org_id = Number(organization.id);

  beforeEach(function () {
    (uniqueId as jest.MockedFunction<typeof uniqueId>).mockReturnValue('345');
  });

  afterEach(function () {
    (trackReloadEvent as jest.Mock).mockClear();
    (trackAmplitudeEvent as jest.Mock).mockClear();
    (trackMarketingEvent as jest.Mock).mockClear();
    (uniqueId as jest.Mock).mockClear();
  });

  it('tracks in reload but not amplitude with undefined organization', function () {
    rawTrackAnalyticsEvent({
      // @ts-expect-error: We're explicitly testing a case with organization=undefined
      organization: undefined,
      eventKey: 'test_event',
      eventName: 'Test Event',
      someProp: 'value',
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        org_id: undefined,
        user_id: parseInt(user.id, 10),
      })
    );
    expect(trackAmplitudeEvent).not.toHaveBeenCalled();
  });

  it('coerces organization_id and project_id and honor existing analytics sessions', function () {
    sessionStorage.setItem('ANALYTICS_SESSION', '789');
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization,
      someProp: 'value',
      project_id: '456',
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        project_id: 456,
        org_id,
        user_id: parseInt(user.id, 10),
        role: 'owner',
        analytics_session_id: '789',
      })
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({
        someProp: 'value',
        role: 'owner',
        project_id: 456,
        analytics_session_id: '789',
        url: 'http://localhost/',
      }),
      {time: undefined}
    );
    expect(uniqueId).not.toHaveBeenCalled();
    sessionStorage.removeItem('ANALYTICS_SESSION');
    expect(trackMarketingEvent).not.toHaveBeenCalled();
  });

  it('allows null organization and set analytics session if missing', function () {
    sessionStorage.removeItem('ANALYTICS_SESSION');
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization: null,
      someProp: 'value',
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        org_id: null,
        analytics_session_id: '345',
      })
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      null,
      expect.objectContaining({someProp: 'value', analytics_session_id: '345'}),
      {time: undefined}
    );
    expect(uniqueId).toHaveBeenCalledWith();
  });

  it('allows string for organization', function () {
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization: org_id.toString(),
      someProp: 'value',
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        org_id,
      })
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({someProp: 'value'}),
      {time: undefined}
    );
  });

  it('if organization is a non number string then use undefined as value', function () {
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization: 'lol',
      someProp: 'value',
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        org_id: undefined,
      })
    );

    expect(trackAmplitudeEvent).not.toHaveBeenCalled();
  });

  it('pass custom referrer', function () {
    window.location.search = '?referrer=test';
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization,
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({custom_referrer: 'test'})
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({custom_referrer: 'test'}),
      {time: undefined}
    );
    window.location.search = '';
  });
  it('start analytics session', function () {
    rawTrackAnalyticsEvent(
      {
        eventKey: 'test_event',
        eventName: 'Test Event',
        organization: null,
      },
      {startSession: true}
    );

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({analytics_session_id: '345'})
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      null,
      expect.objectContaining({analytics_session_id: '345'}),
      {time: undefined}
    );
    expect(uniqueId).toHaveBeenCalledWith();
  });
  it('accepts subscription and sets plan', function () {
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization,
      subscription,
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({plan: 'am1_f'})
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({plan: 'am1_f'}),
      {time: undefined}
    );
  });
  it('applys mapValuesFn', function () {
    rawTrackAnalyticsEvent(
      {
        eventKey: 'test_event',
        eventName: 'Test Event',
        organization,
      },
      {
        mapValuesFn: data => ({...data, new_field: 'test'}),
      }
    );

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({new_field: 'test'})
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({new_field: 'test'}),
      {time: undefined}
    );
  });
  it('send to marketing', function () {
    rawTrackAnalyticsEvent({
      eventKey: 'growth.onboarding_clicked_need_help',
      eventName: 'Growth: Onboarding Clicked Need Help',
      organization,
      subscription,
    });

    expect(trackReloadEvent).toHaveBeenCalledWith(
      'growth.onboarding_clicked_need_help',
      expect.objectContaining({plan: 'am1_f'})
    );

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Growth: Onboarding Clicked Need Help',
      org_id,
      expect.objectContaining({plan: 'am1_f'}),
      {time: undefined}
    );

    expect(trackMarketingEvent).toHaveBeenCalledWith(
      'Growth: Onboarding Clicked Need Help',
      {plan: 'am1_f'}
    );
  });
  it('sets previous_referrer', function () {
    sessionStorage.setItem('previous_referrer', 'something');
    rawTrackAnalyticsEvent({
      eventKey: 'test_event',
      eventName: 'Test Event',
      organization,
    });

    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({previous_referrer: 'something'}),
      {time: undefined}
    );
    sessionStorage.removeItem('previous_referrer');
  });
  it('pass in timestamp', function () {
    rawTrackAnalyticsEvent(
      {
        eventKey: 'test_event',
        eventName: 'Test Event',
        organization: org_id.toString(),
        someProp: 'value',
      },
      {time: 123}
    );
    expect(trackAmplitudeEvent).toHaveBeenCalledWith(
      'Test Event',
      org_id,
      expect.objectContaining({someProp: 'value'}),
      {time: 123}
    );
    expect(trackReloadEvent).toHaveBeenCalledWith(
      'test_event',
      expect.objectContaining({
        someProp: 'value',
        org_id,
        user_id: parseInt(user.id, 10),
        sent_at: '123',
      })
    );
  });
});
