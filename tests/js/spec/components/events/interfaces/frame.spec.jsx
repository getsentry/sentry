import React from 'react';
import {shallow} from 'enzyme';

import Frame from 'app/components/events/interfaces/frame';

describe('Frame', function() {
  let data;

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
      let frame = shallow(<Frame data={data} />);

      expect(frame.find('Tooltip').prop('title')).toMatchSnapshot();
    });
  });
});
