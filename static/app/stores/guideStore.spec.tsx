import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {openModal, closeModal} from '@sentry/scraps/modal';

import {trackAnalytics} from 'sentry/utils/analytics';

import {ConfigStore} from './configStore';
import {GuideStore} from './guideStore';

jest.mock('sentry/utils/analytics');

describe('GuideStore', () => {
  let data!: Parameters<typeof GuideStore.fetchSucceeded>[0];

  beforeEach(() => {
    jest.clearAllMocks();
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          id: '5',
          isSuperuser: false,
          dateJoined: '2020-01-01T00:00:00',
        }),
      })
    );
    GuideStore.reset();
    data = [
      {
        guide: 'trace_view',
        seen: false,
      },
      {guide: 'issue_stream', seen: true},
    ];
    GuideStore.registerAnchor('issue_stream');
    GuideStore.registerAnchor('trace_view_guide_row');
    GuideStore.registerAnchor('trace_view_guide_row_details');
  });

  it('should move through the steps in the guide', () => {
    GuideStore.fetchSucceeded(data);
    // Should pick the first non-seen guide in alphabetic order.
    expect(GuideStore.getState().currentStep).toBe(0);
    expect(GuideStore.getState().currentGuide?.guide).toBe('trace_view');
    // Should prune steps that don't have anchors.
    expect(GuideStore.getState().currentGuide?.steps).toHaveLength(2);

    GuideStore.nextStep();
    expect(GuideStore.getState().currentStep).toBe(1);
    GuideStore.closeGuide();
    expect(GuideStore.getState().currentGuide).toBeNull();
  });

  it('should force show a guide with #assistant', () => {
    data = [
      {
        guide: 'issue_stream',
        seen: true,
      },
      {guide: 'trace_view', seen: false},
    ];

    GuideStore.fetchSucceeded(data);
    window.location.hash = '#assistant';
    GuideStore.onURLChange();
    expect(GuideStore.getState().currentGuide?.guide).toBe('issue_stream');
    GuideStore.closeGuide();
    expect(GuideStore.getState().currentGuide?.guide).toBe('trace_view');
    window.location.hash = '';
  });

  it('should force hide', () => {
    expect(GuideStore.getState().forceHide).toBe(false);
    GuideStore.setForceHide(true);
    expect(GuideStore.getState().forceHide).toBe(true);
    GuideStore.setForceHide(false);
    expect(GuideStore.getState().forceHide).toBe(false);
  });

  it('should record analytics events when guide is cued', () => {
    const spy = jest.spyOn(GuideStore, 'recordCue');
    GuideStore.fetchSucceeded(data);
    expect(spy).toHaveBeenCalledWith('trace_view');

    expect(trackAnalytics).toHaveBeenCalledWith('assistant.guide_cued', {
      guide: 'trace_view',
      organization: null,
    });

    expect(spy).toHaveBeenCalledTimes(1);

    GuideStore.onURLChange();
    expect(spy).toHaveBeenCalledTimes(1);

    GuideStore.nextStep();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('only shows guides with server data and content', () => {
    data = [
      {
        guide: 'issue_stream',
        seen: true,
      },
      {
        guide: 'has_no_content',
        seen: false,
      },
    ];

    GuideStore.fetchSucceeded(data);
    expect(GuideStore.getState().guides).toHaveLength(1);
    expect(GuideStore.getState().guides[0]!.guide).toBe(data[0]!.guide);
  });

  it('hides when a modal is open', () => {
    expect(GuideStore.getState().forceHide).toBe(false);

    openModal(() => <div />, {});

    expect(GuideStore.getState().forceHide).toBe(true);

    closeModal();

    expect(GuideStore.getState().forceHide).toBe(false);
  });

  it('should return a stable reference from getState', () => {
    openModal(() => <div />, {});
    const state = GuideStore.getState();
    expect(Object.is(state, GuideStore.getState())).toBe(true);
  });
});
