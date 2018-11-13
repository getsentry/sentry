import React from 'react';
import GuideStore from 'app/stores/guideStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ConfigStore from 'app/stores/configStore';

describe('GuideStore', function() {
  let sandbox;
  let anchor1 = <GuideAnchor target="target 1" type="text" />;
  let anchor2 = <GuideAnchor target="target 2" type="text" />;
  let data;

  beforeEach(function() {
    ConfigStore.config = {
      user: {
        isSuperuser: true,
      },
      features: new Set(['assistant']),
    };
    GuideStore.init();
    sandbox = sinon.sandbox.create();
    data = {
      Guide1: {
        cue: 'Click here for a tour of the issue page',
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
        cue: 'Some other guide here',
        id: 2,
        required_targets: ['target 1'],
        steps: [
          {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
          {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
        ],
        seen: false,
      },
      alert_reminder_1: {
        id: 3,
        guide_type: 'tip',
        required_targets: ['target 1'],
        steps: [{message: 'Message 1', target: 'target 1', title: '1. Title 1'}],
        seen: false,
      },
    };
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    MockApiClient.addMockResponse({
      url: '/projects/org/proj/stats/',
      body: [[1, 500], [2, 300], [3, 500]],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org/proj/rules/',
      body: [],
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should move through the steps in the guide', async function() {
    GuideStore.onFetchSucceeded(data);
    await tick();
    let guide = GuideStore.state.currentGuide;
    // Should pick the first non-seen guide in alphabetic order.
    expect(guide.id).toEqual(2);
    expect(guide.steps).toHaveLength(2);
    GuideStore.onNextStep();
    expect(GuideStore.state.currentStep).toEqual(1);
    GuideStore.onCloseGuide();
    await tick();
    guide = GuideStore.state.currentGuide;
    // We don't have the alert reminder guide's data yet, so we can't show it.
    expect(guide).toEqual(null);
  });

  it('should not show a guide if the user is not in the experiment', async function() {
    ConfigStore.get('features').delete('assistant');
    GuideStore.onFetchSucceeded(data);
    await tick();
    expect(GuideStore.state.currentGuide).toEqual(null);
  });

  it('should force show a guide', async function() {
    GuideStore.onFetchSucceeded(data);
    await tick();
    window.location.hash = '#assistant';
    GuideStore.onURLChange();
    await tick();
    expect(GuideStore.state.currentGuide.id).toEqual(1);
    // Should prune steps that don't have anchors.
    expect(GuideStore.state.currentGuide.steps).toHaveLength(2);
    GuideStore.onCloseGuide();
    await tick();
    expect(GuideStore.state.currentGuide.id).toEqual(2);
    window.location.hash = '';
  });

  it('should render tip', async function() {
    GuideStore.onFetchSucceeded({
      ...data,
      Guide2: {
        ...data.Guide2,
        seen: true,
      },
    });
    expect(GuideStore.state.currentGuide).toEqual(null);
    let spy = jest.spyOn(GuideStore, 'isDefaultAlert').mockImplementation(() => true);
    GuideStore.onSetActiveOrganization({id: 1, slug: 'org'});
    GuideStore.onSetActiveProject({id: 1, slug: 'proj'});
    await tick();
    expect(GuideStore.state.currentGuide.id).toEqual(3);
    spy.mockRestore();
  });

  it('should record analytics events when guide is cued', async function() {
    let spy = jest.spyOn(GuideStore, 'recordCue');

    GuideStore.onFetchSucceeded(data);
    await tick();
    expect(spy).toHaveBeenCalledWith(data.Guide2.id, data.Guide2.cue);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should not send multiple cue analytics events for same guide', async function() {
    let spy = jest.spyOn(GuideStore, 'recordCue');

    GuideStore.onFetchSucceeded(data);
    await tick();
    expect(spy).toHaveBeenCalledWith(data.Guide2.id, data.Guide2.cue);
    expect(spy).toHaveBeenCalledTimes(1);
    GuideStore.updateCurrentGuide();
    await tick();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
