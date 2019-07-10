import React from 'react';
import GuideStore from 'app/stores/guideStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ConfigStore from 'app/stores/configStore';

describe('GuideStore', function() {
  const anchor1 = <GuideAnchor target="target 1" />;
  const anchor2 = <GuideAnchor target="target 2" />;
  let data;

  beforeEach(function() {
    ConfigStore.config = {
      user: {
        isSuperuser: true,
      },
    };
    GuideStore.init();
    data = {
      Guide1: {
        id: 1,
        required_targets: ['target 1'],
        steps: [
          {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
          {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
          {message: 'Message 3', target: 'target 3', title: '3. Title 3'},
        ],
        seen: true,
      },
      Guide2: {
        id: 2,
        required_targets: ['target 1'],
        steps: [
          {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
          {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
        ],
        seen: false,
      },
    };
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
  });

  afterEach(function() {});

  it('should move through the steps in the guide', function() {
    GuideStore.onFetchSucceeded(data);
    const guide = GuideStore.state.currentGuide;
    // Should pick the first non-seen guide in alphabetic order.
    expect(guide.id).toEqual(2);
    expect(guide.steps).toHaveLength(2);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onCloseGuide();
    expect(GuideStore.state.currentGuide).toEqual(null);
  });

  it('should force show a guide', function() {
    GuideStore.onFetchSucceeded(data);
    window.location.hash = '#assistant';
    GuideStore.onURLChange();
    expect(GuideStore.state.currentGuide.id).toEqual(1);
    // Should prune steps that don't have anchors.
    expect(GuideStore.state.currentGuide.steps).toHaveLength(2);
    GuideStore.onCloseGuide();
    expect(GuideStore.state.currentGuide.id).toEqual(2);
    window.location.hash = '';
  });

  it('should record analytics events when guide is cued', function() {
    const spy = jest.spyOn(GuideStore, 'recordCue');
    GuideStore.onFetchSucceeded(data);
    expect(spy).toHaveBeenCalledWith(data.Guide2.id);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should not send multiple cue analytics events for same guide', function() {
    const spy = jest.spyOn(GuideStore, 'recordCue');
    GuideStore.onFetchSucceeded(data);
    expect(spy).toHaveBeenCalledWith(data.Guide2.id);
    expect(spy).toHaveBeenCalledTimes(1);
    GuideStore.updateCurrentGuide();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
