import cloneDeep from 'lodash/cloneDeep';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Event} from 'sentry/types';

import {SetupSourceMapsAlert} from './setupSourceMapsAlert';

const alertText = 'Sentry can un-minify your code to show you more readable stack traces';

function modifyEventFrames(event: Event, modify: any): Event {
  const modifiedEvent = cloneDeep(event);
  modifiedEvent.entries[0].data.values[0].stacktrace.frames =
    event.entries[0].data.values[0].stacktrace.frames.map(frame => ({
      ...frame,
      ...modify,
    }));
  return modifiedEvent;
}

describe('SetupSourceMapsAlert', function () {
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

  it('does NOT show alert if javascript platform and source maps found', function () {
    const event = TestStubs.ExceptionWithRawStackTrace();

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });

  it('does NOT show alert if all filenames are anonymous', function () {
    const event = modifyEventFrames(
      TestStubs.EventStacktraceException({
        platform: 'javascript',
      }),
      {filename: '<anonymous>'}
    );

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });

  it('does NOT show alert if all function names are on the blocklist', function () {
    const event = modifyEventFrames(
      TestStubs.EventStacktraceException({
        platform: 'javascript',
      }),
      {function: '@webkit-masked-url'}
    );

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });

  it('does NOT show alert if all absolute paths do not have a file extension', function () {
    const event = modifyEventFrames(
      TestStubs.EventStacktraceException({
        platform: 'javascript',
      }),
      {absPath: 'https://sentry.io/'}
    );

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });

  it('shows alert if javascript platform and source maps not found', function () {
    const event = TestStubs.EventStacktraceException({platform: 'javascript'});

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.getByText(alertText)).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });

  it('show documentation for react according to the sdk name', function () {
    const event = TestStubs.EventStacktraceException({
      sdk: {name: 'sentry.javascript.react'},
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.getByText(alertText)).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show documentation for react according to the event platform', function () {
    const event = TestStubs.EventStacktraceException({
      platform: 'react',
      sdk: {name: 'sentry.javascript.browser'},
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.getByText(alertText)).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show generic documentation if doc link not available', function () {
    const event = TestStubs.EventStacktraceException({
      platform: 'unity',
    });

    render(<SetupSourceMapsAlert event={event} />, {
      organization,
      router,
    });

    expect(screen.getByText(alertText)).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });

  it('show localhost copy', function () {
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

    expect(screen.getByRole('link', {name: 'Upload Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });
});
