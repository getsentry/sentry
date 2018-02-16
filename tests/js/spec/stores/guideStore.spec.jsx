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
      steps: {
        0: {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
        1: {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
      },
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
    expect(GuideStore.state.currentStep).toEqual(null);
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
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(0);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onCloseGuide();
    expect(GuideStore.state.guidesSeen).toEqual(new Set([1]));
  });
});
