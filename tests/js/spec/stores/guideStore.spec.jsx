import React from 'react';
import GuideStore from 'app/stores/guideStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';

describe('GuideStore', function() {
  let sandbox;
  let data = {
    issue: {
      cue: 'Click here for a tour of the issue page',
      id: 1,
      page: 'issue',
      required_targets: ['target 1'],
      steps: [
        {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
        {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
        {message: 'Message 3', target: 'target 3', title: '3. Title 3'},
      ],
      seen: false,
    },
  };

  let anchor1 = <GuideAnchor target="target 1" type="text" />;
  let anchor2 = <GuideAnchor target="target 2" type="text" />;

  beforeEach(function() {
    GuideStore.init();
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should add guides to store', function() {
    GuideStore.onFetchSucceeded(data);
    expect(GuideStore.state.guides).toEqual(data);
    expect(GuideStore.state.currentStep).toEqual(0);
  });

  it('should register anchors', function() {
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    expect(GuideStore.state.anchors).toEqual(new Set([anchor1, anchor2]));
  });

  it('should move through the steps in the guide', function() {
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    // GuideStore should prune steps that don't have anchors.
    expect(GuideStore.state.currentGuide.steps).toHaveLength(2);
    expect(GuideStore.state.currentGuide.seen).toEqual(false);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(2);
    GuideStore.onCloseGuideOrSupport();
  });

  it('should not show seen guides', function() {
    data.issue.seen = true;
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    // GuideStore should prune steps that don't have anchors.
    expect(GuideStore.state.currentGuide).toEqual(null);
  });

  it('should force show a guide', function() {
    window.location.hash = '#assistant';
    data.issue.seen = true;
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    expect(GuideStore.state.currentGuide.steps).toHaveLength(2);
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(2);
    GuideStore.onCloseGuideOrSupport();
  });
});
