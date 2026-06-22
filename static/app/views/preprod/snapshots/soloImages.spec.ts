import {buildSoloImages} from 'sentry/views/preprod/snapshots/soloImages';
import type {
  SnapshotDetailsApiResponse,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

function img(name: string, key = name): SnapshotImage {
  return {
    image_file_name: name,
    display_name: name,
    key,
    width: 10,
    height: 10,
    tags: null,
  };
}

function pair(name: string): SnapshotDiffPair {
  return {
    head_image: img(name, `${name}-head`),
    base_image: img(name, `${name}-base`),
    diff: 0.1,
    diff_image_key: null,
  };
}

function response(
  overrides: Partial<SnapshotDetailsApiResponse>
): SnapshotDetailsApiResponse {
  return {
    comparison_type: 'diff',
    images: [],
    added: [],
    changed: [],
    removed: [],
    unchanged: [],
    ...overrides,
  } as SnapshotDetailsApiResponse;
}

describe('buildSoloImages', () => {
  it('returns data.images unchanged for a solo comparison', () => {
    const images = [img('b.png'), img('a.png')];
    expect(buildSoloImages(response({comparison_type: 'solo', images}))).toBe(images);
  });

  it('returns data.images for waiting_for_base', () => {
    const images = [img('a.png')];
    expect(buildSoloImages(response({comparison_type: 'waiting_for_base', images}))).toBe(
      images
    );
  });

  it('derives the head-side union sorted by image_file_name for a diff', () => {
    const result = buildSoloImages(
      response({
        comparison_type: 'diff',
        unchanged: [img('c.png')],
        changed: [pair('a.png')],
        added: [img('b.png')],
      })
    );
    expect(result.map(i => i.image_file_name)).toEqual(['a.png', 'b.png', 'c.png']);
    // changed entries use head_image
    expect(result[0]!.key).toBe('a.png-head');
  });

  it('excludes removed (base-only) images in a diff', () => {
    const result = buildSoloImages(
      response({
        comparison_type: 'diff',
        unchanged: [img('keep.png')],
        removed: [img('gone.png')],
      })
    );
    expect(result.map(i => i.image_file_name)).toEqual(['keep.png']);
  });

  it('ignores data.images when deriving a diff (backward compatible)', () => {
    const result = buildSoloImages(
      response({
        comparison_type: 'diff',
        images: [img('stale.png')],
        unchanged: [img('real.png')],
      })
    );
    expect(result.map(i => i.image_file_name)).toEqual(['real.png']);
  });

  it('handles missing optional renamed/errored arrays', () => {
    const result = buildSoloImages(
      response({comparison_type: 'diff', unchanged: [img('a.png')]})
    );
    expect(result.map(i => i.image_file_name)).toEqual(['a.png']);
  });
});
