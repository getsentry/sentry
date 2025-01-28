import {
  getDiffNE,
  getDiffNW,
  getDiffSE,
  getDiffSW,
} from 'sentry/components/avatarUploader';

describe('AvatarUploader', function () {
  describe('getDiffNW', function () {
    it(
      'should return a negative diff when yDiff and xDiff ' +
        'are positive (cropper is getting smaller)',
      function () {
        expect(getDiffNW(4, 5)).toBe(-4.5);
      }
    );

    it(
      'should return a positive diff when yDiff and xDiff ' +
        'are negative (cropper is getting bigger)',
      function () {
        expect(getDiffNW(-4, -5)).toBe(4.5);
      }
    );
  });

  describe('getDiffNE', function () {
    it(
      'should return a positive diff when yDiff is negative and ' +
        'xDiff is positive (cropper is getting bigger)',
      function () {
        expect(getDiffNE(-4, 5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting smaller)',
      function () {
        expect(getDiffNE(4, -5)).toBe(-4.5);
      }
    );
  });

  describe('getDiffSE', function () {
    it(
      'should return a positive diff when yDiff and ' +
        'xDiff are positive (cropper is getting bigger)',
      function () {
        expect(getDiffSE(4, 5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff and ' +
        'xDiff are negative (cropper is getting smaller)',
      function () {
        expect(getDiffSE(-4, -5)).toBe(-4.5);
      }
    );
  });

  describe('getDiffSW', function () {
    it(
      'should return a positive diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting bigger)',
      function () {
        expect(getDiffSW(4, -5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is negative and' +
        'xDiff is positive (cropper is getting smaller)',
      function () {
        expect(getDiffSW(-4, 5)).toBe(-4.5);
      }
    );
  });
});
