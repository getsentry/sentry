import {trackAnalyticsEvent} from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import GuideStore from 'app/stores/guideStore';

jest.mock('app/utils/analytics');

describe('GuideStore', function() {
  let data;
  const user = {
    id: '5',
    isSuperuser: false,
    dateJoined: new Date(2020, 0, 1),
  };

  beforeEach(function() {
    trackAnalyticsEvent.mockClear();
    ConfigStore.config = {
      user,
    };
    GuideStore.init();
    data = [
      {
        guide: 'issue',
        seen: false,
      },
      {guide: 'issue_stream', seen: true},
    ];
    GuideStore.onRegisterAnchor('issue_title');
    GuideStore.onRegisterAnchor('exception');
    GuideStore.onRegisterAnchor('breadcrumbs');
    GuideStore.onRegisterAnchor('issue_stream');
  });

  it('should move through the steps in the guide', function() {
    GuideStore.onFetchSucceeded(data);
    // Should pick the first non-seen guide in alphabetic order.
    expect(GuideStore.state.currentStep).toEqual(0);
    expect(GuideStore.state.currentGuide.guide).toEqual('issue');
    // Should prune steps that don't have anchors.
    expect(GuideStore.state.currentGuide.steps).toHaveLength(3);

    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(2);
    GuideStore.onCloseGuide();
    expect(GuideStore.state.currentGuide).toEqual(null);
  });

  it('should force show a guide with #assistant', function() {
    data = [
      {
        guide: 'issue',
        seen: true,
      },
      {guide: 'issue_stream', seen: false},
    ];

    GuideStore.onFetchSucceeded(data);
    window.location.hash = '#assistant';
    GuideStore.onURLChange();
    expect(GuideStore.state.currentGuide.guide).toEqual('issue');
    GuideStore.onCloseGuide();
    expect(GuideStore.state.currentGuide.guide).toEqual('issue_stream');
    window.location.hash = '';
  });

  it('should record analytics events when guide is cued', function() {
    const spy = jest.spyOn(GuideStore, 'recordCue');
    GuideStore.onFetchSucceeded(data);
    expect(spy).toHaveBeenCalledWith('issue');

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      guide: 'issue',
      eventKey: 'assistant.guide_cued',
      eventName: 'Assistant Guide Cued',
      organization_id: null,
      user_id: parseInt(user.id, 10),
    });

    expect(spy).toHaveBeenCalledTimes(1);

    GuideStore.updateCurrentGuide();
    expect(spy).toHaveBeenCalledTimes(1);

    GuideStore.onNextStep();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('only shows guides with server data and content', function() {
    data = [
      {
        guide: 'issue',
        seen: true,
      },
      {
        guide: 'has_no_content',
        seen: false,
      },
    ];

    GuideStore.onFetchSucceeded(data);
    expect(GuideStore.state.guides.length).toBe(1);
    expect(GuideStore.state.guides[0].guide).toBe(data[0].guide);
  });
});
