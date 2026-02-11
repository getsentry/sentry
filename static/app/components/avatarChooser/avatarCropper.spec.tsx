import {getDiffNE, getDiffNW, getDiffSE, getDiffSW} from './avatarCropper';

describe('AvatarCropper', () => {
  describe('getDiffNW', () => {
    it(
      'should return a negative diff when yDiff and xDiff ' +
        'are positive (cropper is getting smaller)',
      () => {
        expect(getDiffNW(4, 5)).toBe(-4.5);
      }
    );

    it(
      'should return a positive diff when yDiff and xDiff ' +
        'are negative (cropper is getting bigger)',
      () => {
        expect(getDiffNW(-4, -5)).toBe(4.5);
      }
    );
  });

  describe('getDiffNE', () => {
    it(
      'should return a positive diff when yDiff is negative and ' +
        'xDiff is positive (cropper is getting bigger)',
      () => {
        expect(getDiffNE(-4, 5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting smaller)',
      () => {
        expect(getDiffNE(4, -5)).toBe(-4.5);
      }
    );
  });

  describe('getDiffSE', () => {
    it(
      'should return a positive diff when yDiff and ' +
        'xDiff are positive (cropper is getting bigger)',
      () => {
        expect(getDiffSE(4, 5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff and ' +
        'xDiff are negative (cropper is getting smaller)',
      () => {
        expect(getDiffSE(-4, -5)).toBe(-4.5);
      }
    );
  });

  describe('getDiffSW', () => {
    it(
      'should return a positive diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting bigger)',
      () => {
        expect(getDiffSW(4, -5)).toBe(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is negative and' +
        'xDiff is positive (cropper is getting smaller)',
      () => {
        expect(getDiffSW(-4, 5)).toBe(-4.5);
      }
    );
  });
});
