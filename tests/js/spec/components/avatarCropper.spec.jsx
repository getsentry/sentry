import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import AvatarCropper from 'app/components/avatarCropper';

describe('AvatarCropper', function() {
  const USER = {
    email: 'a@example.com',
    avatar: {
      avatarType: 'gravatar',
      avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
    },
  };

  describe('getDiffNW', function() {
    it(
      'should return a negative diff when yDiff and xDiff ' +
        'are positive (cropper is getting smaller)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffNW(4, 5);
        expect(diff).toEqual(-4.5);
      }
    );

    it(
      'should return a positive diff when yDiff and xDiff ' +
        'are negative (cropper is getting bigger)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffNW(-4, -5);
        expect(diff).toEqual(4.5);
      }
    );
  });

  describe('getDiffNE', function() {
    it(
      'should return a positive diff when yDiff is negative and ' +
        'xDiff is positive (cropper is getting bigger)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffNE(-4, 5);
        expect(diff).toEqual(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting smaller)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffNE(4, -5);
        expect(diff).toEqual(-4.5);
      }
    );
  });

  describe('getDiffSE', function() {
    it(
      'should return a positive diff when yDiff and ' +
        'xDiff are positive (cropper is getting bigger)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffSE(4, 5);
        expect(diff).toEqual(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff and ' +
        'xDiff are negative (cropper is getting smaller)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffSE(-4, -5);
        expect(diff).toEqual(-4.5);
      }
    );
  });

  describe('getDiffSW', function() {
    it(
      'should return a positive diff when yDiff is positive and ' +
        'xDiff is negative (cropper is getting bigger)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffSW(4, -5);
        expect(diff).toEqual(4.5);
      }
    );

    it(
      'should return a negative diff when yDiff is negative and' +
        'xDiff is positive (cropper is getting smaller)',
      function() {
        const cropper = mountWithTheme(
          <AvatarCropper model={USER} updateDataUrlState={function() {}} />
        ).instance();
        const diff = cropper.getDiffSW(-4, 5);
        expect(diff).toEqual(-4.5);
      }
    );
  });
});
