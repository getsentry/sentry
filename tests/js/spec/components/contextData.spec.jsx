import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

import ContextData from 'app/components/contextData';

describe('ContextData', function() {

  describe('render()', function() {
    describe('strings', function () {
      it('should render urls w/ an additional <a> link', function () {
        const URL = 'https://example.org/foo/bar/';
        let ctxData = TestUtils.renderIntoDocument(<ContextData data={URL}/>);

        let node = ReactDOM.findDOMNode(ctxData);

        expect(node.getElementsByTagName('span')[0]).to.have.property('textContent', URL);
        expect(node.getElementsByTagName('a')[0]).to.have.property('href', URL);
      });
    });
  });

});

