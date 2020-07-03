import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ContextData from 'app/components/contextData';

describe('ContextData', function() {
  describe('render()', function() {
    describe('strings', function() {
      it('should render urls w/ an additional <a> link', function() {
        const URL = 'https://example.org/foo/bar/';
        const wrapper = shallow(<ContextData data={URL} />);

        expect(
          wrapper
            .find('span')
            .at(0)
            .text()
        ).toEqual(URL);
        expect(
          wrapper
            .find('a')
            .at(0)
            .prop('href')
        ).toEqual(URL);
      });
    });
  });
});
