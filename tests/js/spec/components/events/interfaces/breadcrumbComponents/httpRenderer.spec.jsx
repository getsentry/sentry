import React from 'react';
import {shallow} from 'enzyme';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbComponents/httpRenderer';

describe('HttpRenderer', function() {
  describe('render()', function() {
    it('should work', function () {
      let httpRendererWrapper = shallow(<HttpRenderer crumb={{
        data: {
          method: 'POST',
          url: 'http://example.com/foo',
          // status_code 0 is possible via broken client-side XHR; should still render as '[0]'
          status_code: 0
        }
      }}/>);

      let summaryLine = httpRendererWrapper.prop('summary');

      let summaryLineWrapper = shallow(summaryLine);
      expect(summaryLineWrapper.find('strong').text()).to.eql('POST ');
      expect(summaryLineWrapper.find('a').text().trim()).to.eql('http://example.com/foo');
      expect(summaryLineWrapper.find('span').text()).to.eql(' [0]');
    });
  });
});
