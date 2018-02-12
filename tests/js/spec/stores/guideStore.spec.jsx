import React from 'react';
import GuideStore from 'app/stores/guideStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';

describe('GuideStore', function() {
  let sandbox;

  beforeEach(function() {
    GuideStore.init();
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('onFetchSuccess()', function() {
    it('should add guides to store', function() {
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

      GuideStore.onFetchSuccess(data);
      expect(GuideStore.state.guides).toEqual(data);
      expect(GuideStore.state.currentStep).toEqual(null);
    });

    it('should move to the next step in the guide', function() {
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
      GuideStore.registerAnchor(<GuideAnchor target="target 1" type="text" />);
      GuideStore.registerAnchor(<GuideAnchor target="target 2" type="text" />);
      GuideStore.onFetchSuccess(data);
      GuideStore.onNextStep();
      expect(GuideStore.state.currentStep).toEqual(0);
      GuideStore.onNextStep();
      expect(GuideStore.state.currentStep).toEqual(1);
      GuideStore.onGuideClose();
      expect(GuideStore.state.guidesSeen).toEqual(new Set([1]));
    });
  });
});
