import {getSnapshotImageUrl} from 'sentry/views/preprod/types/snapshotTypes';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

function makeImage(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: 'danger-no-icon',
    image_file_name: 'static/app/components/core/alert/alert-dark-danger-no-icon.png',
    height: 130,
    key: 'abc123',
    tags: null,
    width: 800,
    ...overrides,
  };
}

describe('getSnapshotImageUrl', () => {
  const baseUrl = '/api/0/projects/org/1/files/images/';

  it('appends the basename of image_file_name as a filename query param', () => {
    expect(getSnapshotImageUrl(baseUrl, makeImage())).toBe(
      `${baseUrl}abc123/?filename=alert-dark-danger-no-icon.png`
    );
  });

  it('encodes special characters in the filename', () => {
    const url = getSnapshotImageUrl(
      baseUrl,
      makeImage({image_file_name: 'a b/café & co.png'})
    );
    expect(url).toBe(`${baseUrl}abc123/?filename=${encodeURIComponent('café & co.png')}`);
  });

  it('never falls back to display_name when image_file_name is empty', () => {
    const url = getSnapshotImageUrl(
      baseUrl,
      makeImage({image_file_name: '', display_name: 'fallback.png'})
    );
    expect(url).toBe(`${baseUrl}abc123/`);
  });

  it('omits the query param when image_file_name is empty', () => {
    const url = getSnapshotImageUrl(
      baseUrl,
      makeImage({image_file_name: '', display_name: null})
    );
    expect(url).toBe(`${baseUrl}abc123/`);
  });
});
