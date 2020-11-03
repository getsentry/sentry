import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';

describe('HttpRenderer', function () {
  describe('render()', function () {
    it('should work', function () {
      const httpRendererWrapper = shallow(
        <HttpRenderer
          breadcrumb={{
            data: {
              method: 'POST',
              url: 'http://example.com/foo',
              // status_code 0 is possible via broken client-side XHR; should still render as '[0]'
              status_code: 0,
            },
          }}
        />
      );

      const summaryLine = httpRendererWrapper.prop('summary');

      const summaryLineWrapper = shallow(summaryLine).render();
      expect(summaryLineWrapper.find('strong').text()).toEqual('POST ');
      expect(
        summaryLineWrapper
          .find('[data-test-id="http-renderer-external-link"]')
          .text()
          .trim()
      ).toEqual('http://example.com/foo');
      expect(
        summaryLineWrapper.find('[data-test-id="http-renderer-status-code"]').text()
      ).toEqual(' [0]');
    });

    it("shouldn't blow up if crumb.data is missing", function () {
      const httpRendererWrapper = mountWithTheme(
        <HttpRenderer
          breadcrumb={{
            category: 'xhr',
            type: 'http',
          }}
        />
      );

      expect(httpRendererWrapper.find('CrumbCategory').text()).toEqual('xhr');
    });

    it("shouldn't blow up if url is not a string", function () {
      const httpRendererWrapper = mountWithTheme(
        <HttpRenderer
          breadcrumb={{
            category: 'xhr',
            type: 'http',
            data: {
              method: 'GET',
              url: {},
            },
          }}
        />
      );

      expect(httpRendererWrapper.find('CrumbCategory').text()).toEqual('xhr');
    });
  });
});
