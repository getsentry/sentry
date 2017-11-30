import React from 'react';
import TestUtils from 'react-addons-test-utils';

import Frame from 'app/components/events/interfaces/frame';
import FrameVariables from 'app/components/events/interfaces/frameVariables';

import stubReactComponents from '../../../../helpers/stubReactComponent';

describe('Frame', function() {
  let sandbox;
  let data;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    stubReactComponents(sandbox, [FrameVariables]);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('renderOriginalSourceInfo()', function() {
    beforeEach(function() {
      data = {
        origAbsPath: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js',
        origColNo: 2503,
        origFilename: '/_static/sentry/dist/vendor.js',
        origFunction: 'T._updateRenderedComponent',
        origLineNo: 419,
        map: 'vendor.js.map',
        mapUrl: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js.map',
      };
    });

    it('should render the source map information as a HTML string', function() {
      let frame = TestUtils.renderIntoDocument(<Frame data={data} />);

      // NOTE: indentation/whitespace intentional to match output string
      expect(frame.renderOriginalSourceInfo()).toEqual(
        '\n    <div>\n      <strong>Source Map</strong><br/>https://beta.getsentry.com/_static/sentry/dist/vendor.js.map<br/></div>'
      );
    });
  });
});
