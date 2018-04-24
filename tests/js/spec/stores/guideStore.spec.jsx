import React from 'react';
import GuideStore from 'app/stores/guideStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';

describe('GuideStore', function() {
  let sandbox;
  let anchor1 = <GuideAnchor target="target 1" type="text" />;
  let anchor2 = <GuideAnchor target="target 2" type="text" />;
  let data;

  beforeEach(function() {
    GuideStore.init();
    sandbox = sinon.sandbox.create();
    data = {
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
      other: {
        cue: 'Some other guide here',
        id: 2,
        page: 'random',
        required_targets: ['target 1'],
        steps: [
          {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
          {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
        ],
        seen: false,
      },
    };
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
    expect(
      Object.keys(GuideStore.state.guides).filter(
        key => GuideStore.state.guides[key].seen == true
      )
    ).toEqual(['issue']);
  });

  it('should not show seen guides', function() {
    data.issue.seen = true;
    data.other.seen = true;
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    expect(GuideStore.state.currentGuide).toEqual(null);
  });

  it('should force show a guide', function() {
    data.issue.seen = true;
    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.state.forceShow = true;
    GuideStore.onFetchSucceeded(data);
    expect(GuideStore.state.currentGuide).not.toEqual(null);
  });

  it('should record analytics events when guide is cued', function() {
    let mockRecordCue = jest.fn();
    GuideStore.recordCue = mockRecordCue;

    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    expect(mockRecordCue).toHaveBeenCalledWith(data.issue.id, data.issue.cue);
    expect(mockRecordCue).toHaveBeenCalledTimes(1);
    GuideStore.onCloseGuideOrSupport();

    // Should trigger a record when a new guide is cued
    expect(GuideStore.state.currentGuide).toEqual(data.other);
    expect(mockRecordCue).toHaveBeenCalledWith(data.other.id, data.other.cue);
    expect(mockRecordCue).toHaveBeenCalledTimes(2);
  });

  it('should not send multiple cue analytics events for same guide', function() {
    let mockRecordCue = jest.fn();
    GuideStore.recordCue = mockRecordCue;

    GuideStore.onRegisterAnchor(anchor1);
    GuideStore.onRegisterAnchor(anchor2);
    GuideStore.onFetchSucceeded(data);
    expect(mockRecordCue).toHaveBeenCalledWith(data.issue.id, data.issue.cue);
    expect(mockRecordCue).toHaveBeenCalledTimes(1);
    GuideStore.updateCurrentGuide();
    expect(mockRecordCue).toHaveBeenCalledTimes(1);
  });
});
