import React from 'react';
import {shallow} from 'enzyme';

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
        ).toEqual('"' + URL + '"'); // Quotes should not be stripped away to ensure valid json
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
