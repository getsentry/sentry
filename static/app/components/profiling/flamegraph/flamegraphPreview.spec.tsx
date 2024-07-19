import {computePreviewConfigView} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

describe('computePreviewConfigView', function () {
  it('uses early exit with 0', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1],
      samples: [
        [0, 1],
        [0, 1],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    // the view should be taller than the flamegraph
    const configView = new Rect(0, 0, 2, 3);

    // go from timestamps 0 to 2
    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      0,
      2
    );

    // y is 0 here because the config view is taller than the flamegraph
    expect(previewConfigView).toEqual(new Rect(0, 0, 2, 3));
    expect(mode).toEqual('anchorTop');
  });

  it('uses max depth', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1],
      samples: [
        [0, 1, 0],
        [1, 0, 1],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    // limit the view to 2 rows tall
    const configView = new Rect(0, 0, 2, 2);

    // go from timestamps 0 to 2
    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      0,
      2
    );

    // y is 1 here because the config view has height 2 so it can only
    // show 2 frames and we show the inner most frames
    expect(previewConfigView).toEqual(new Rect(0, 1, 2, 2));
    expect(mode).toEqual('anchorBottom');
  });

  it('uses max depth in window', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1, 1],
      samples: [
        [0, 1, 0, 1],
        [1, 0, 1],
        [0, 1, 0],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    // limit the view to 2 rows talls
    const configView = new Rect(0, 0, 3, 2);

    // go from timestamps 1 to 3 to exclude the first stack
    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      1,
      3
    );

    // y is 1 here because the config view has height 2 so it can only
    // show 2 frames and we show the inner most frames
    expect(previewConfigView).toEqual(new Rect(1, 1, 2, 2));
    expect(mode).toEqual('anchorBottom');
  });

  it('uses 0 when view is taller than profile', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1],
      samples: [
        [0, 1],
        [1, 0],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    // make taller than profile's deepest stack
    const configView = new Rect(0, 0, 2, 3);

    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      0,
      2
    );

    // y is 0 here because the config view has height 3
    // so the whole flamechart fits
    expect(previewConfigView).toEqual(new Rect(0, 0, 2, 3));
    expect(mode).toEqual('anchorTop');
  });

  it('uses parent frame depth', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [2, 2],
      samples: [
        [0, 1, 0, 1],
        [0, 1, 1, 1],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    const configView = new Rect(0, 0, 4, 2);

    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      1,
      3
    );

    // y is 1 here because we found a frame `f1` that is wraps
    // around the window at depth 1
    expect(previewConfigView).toEqual(new Rect(1, 1, 2, 2));
    expect(mode).toEqual('anchorTop');
  });

  it('uses max depth because there is room above parent to show more', function () {
    const rawProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [2, 2],
      samples: [
        [0, 1, 0],
        [0, 1, 1],
      ],
    };

    const profile = SampledProfile.FromProfile(
      rawProfile,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {});

    const configView = new Rect(0, 0, 4, 3);

    const {configView: previewConfigView, mode} = computePreviewConfigView(
      flamegraph,
      configView,
      1,
      3
    );

    // y is 0 here because the config view has height 3
    // so the whole flamechart fits even though the parent
    // is at depth 1
    expect(previewConfigView).toEqual(new Rect(1, 0, 2, 3));
    expect(mode).toEqual('anchorTop');
  });
});
