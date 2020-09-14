import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import HttpRenderer from 'app/components/events/interfaces/breadcrumbsV2/data/http';
import {
  BreadcrumbType,
  BreadcrumbLevelType,
} from 'app/components/events/interfaces/breadcrumbsV2/types';

describe('HttpRenderer', () => {
  describe('render', () => {
    it.only('should work', () => {
      const httpRendererWrapper = mountWithTheme(
        <HttpRenderer
          searchTerm=""
          breadcrumb={{
            type: BreadcrumbType.HTTP,
            level: BreadcrumbLevelType.INFO,
            data: {
              method: 'POST',
              url: 'http://example.com/foo',
              // status_code 0 is possible via broken client-side XHR; should still render as '[0]'
              status_code: 0,
            },
          }}
        />
      );

      const annotatedTexts = httpRendererWrapper.find('AnnotatedText');

      expect(annotatedTexts.length).toEqual(3);

      expect(
        annotatedTexts
          .at(0)
          .find('strong')
          .text()
      ).toEqual('POST ');

      expect(
        annotatedTexts
          .at(1)
          .find('a[data-test-id="http-renderer-external-link"]')
          .text()
      ).toEqual('http://example.com/foo');

      expect(
        annotatedTexts
          .at(2)
          .find('Highlight[data-test-id="http-renderer-status-code"]')
          .text()
      ).toEqual(' [0]');
    });

    it("shouldn't blow up if crumb.data is missing", function() {
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

    it("shouldn't blow up if url is not a string", function() {
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
