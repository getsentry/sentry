import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

import {CrumbWalker, StringWalker} from './urlWalker';

describe('UrlWalker', () => {
  describe('StringWalker', () => {
    it('should accept a list of strings and render a <ChevronDividedList />', () => {
      const urls = [
        'https://sourcemaps.io/',
        '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
        '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js',
        '/report/1669088971516_https%3A%2F%2Fcdn.ravenjs.com%2F3.17.0%2Fraven.min.js',
      ];

      render(<StringWalker urls={urls} />);

      expect(screen.getByText('https://sourcemaps.io/')).toBeInTheDocument();
      expect(screen.getByText('2 Pages')).toBeInTheDocument();
      expect(
        screen.getByText(
          '/report/1669088971516_https%3A%2F%2Fcdn.ravenjs.com%2F3.17.0%2Fraven.min.js'
        )
      ).toBeInTheDocument();
    });
  });

  describe('CrumbWalker', () => {
    const replayRecord = TestStubs.ReplayRecord({});

    const PAGELOAD_CRUMB = TestStubs.Breadcrumb({
      id: 4,
      data: {
        to: 'https://sourcemaps.io/',
      },
    }) as Crumb;

    const NAV_CRUMB_BOOTSTRAP = TestStubs.Breadcrumb({
      id: 5,
      data: {
        from: '/',
        to: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
      },
    }) as Crumb;

    const NAV_CRUMB_UNDERSCORE = TestStubs.Breadcrumb({
      id: 6,
      data: {
        from: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
        to: '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js',
      },
    }) as Crumb;

    it('should accept a list of crumbs and render a <ChevronDividedList />', () => {
      const crumbs = [
        PAGELOAD_CRUMB,
        NAV_CRUMB_BOOTSTRAP,
        NAV_CRUMB_BOOTSTRAP,
        NAV_CRUMB_BOOTSTRAP,
        NAV_CRUMB_UNDERSCORE,
      ];

      render(<CrumbWalker crumbs={crumbs} replayRecord={replayRecord} />);

      expect(screen.getByText('https://sourcemaps.io/')).toBeInTheDocument();
      expect(screen.getByText('3 Pages')).toBeInTheDocument();
      expect(
        screen.getByText(
          '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js'
        )
      ).toBeInTheDocument();
    });

    it('should filter out non-navigation crumbs', () => {
      const ERROR_CRUMB = TestStubs.Breadcrumb({
        type: BreadcrumbType.ERROR,
      });

      const crumbs = [ERROR_CRUMB];

      render(<CrumbWalker crumbs={crumbs} replayRecord={replayRecord} />);
      expect(screen.getByText('0 Pages')).toBeInTheDocument();
    });
  });
});
