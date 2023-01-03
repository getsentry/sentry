import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SetupSourceMapsAlert} from './setupSourceMapsAlert';

describe('SetupSourceMapsAlert', function () {
  it('NOT show alert if javascript platform and source maps found', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });

    const event = TestStubs.ExceptionWithRawStackTrace();

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.queryByText(
        'Sentry can un-minify your code to show you more readable stack traces'
      )
    ).not.toBeInTheDocument();
  });

  it('show alert if javascript platform and source maps not found', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });

    const event = TestStubs.EventStacktraceException({platform: 'javascript'});

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        'Sentry can un-minify your code to show you more readable stack traces'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });

  it('show documentation for react according to the sdk name', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });

    const event = TestStubs.EventStacktraceException({
      sdk: {name: 'sentry.javascript.react'},
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        'Sentry can un-minify your code to show you more readable stack traces'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show documentation for react according to the event platform', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });

    const event = TestStubs.EventStacktraceException({
      platform: 'react',
      sdk: {name: 'sentry.javascript.browser'},
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        'Sentry can un-minify your code to show you more readable stack traces'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show generic documentation if doc link not available', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });

    const event = TestStubs.EventStacktraceException({
      platform: 'unity',
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        'Sentry can un-minify your code to show you more readable stack traces'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });

  it('show localhost copy', function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {...initializeOrg().organization, features: ['source-maps-cta']},
      router: {
        ...initializeOrg().router,
        location: {
          ...initializeOrg().router.location,
          query: {project: '1'},
        },
      },
    });
    const event = TestStubs.EventStacktraceException({
      platform: 'unity',
      tags: [
        {
          key: 'url',
          value: 'http://localhost:3000',
        },
      ],
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        'In production, you might have minified JS code that makes stack traces hard to read. Sentry can un-minify it for you'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });
});
