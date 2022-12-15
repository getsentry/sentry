import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SetupSourceMapsAlert} from './setupSourceMapsAlert';

describe('SetupSourceMapsAlert', function () {
  it('NOT show alert if javascript platform and source maps found', function () {
    const {project, organization} = initializeOrg();
    const event = TestStubs.ExceptionWithRawStackTrace();

    render(<SetupSourceMapsAlert projectId={project.id} event={event} />, {
      organization,
    });

    expect(
      screen.queryByText('Get Sentry ready for your production environment')
    ).not.toBeInTheDocument();
  });

  it('show alert if javascript platform and source maps not found', function () {
    const {project, organization} = initializeOrg();
    const event = TestStubs.EventStacktraceException({platform: 'javascript'});

    render(<SetupSourceMapsAlert projectId={project.id} event={event} />, {
      organization,
    });

    expect(
      screen.getByText('Get Sentry ready for your production environment')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Setup Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });

  it('show documentation for react according to the sdk name', function () {
    const {project, organization} = initializeOrg();
    const event = TestStubs.EventStacktraceException({
      sdk: {name: 'sentry.javascript.react'},
    });

    render(<SetupSourceMapsAlert projectId={project.id} event={event} />, {
      organization,
    });

    expect(
      screen.getByText('Get Sentry ready for your production environment')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Setup Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show documentation for react according to the event platform', function () {
    const {project, organization} = initializeOrg();
    const event = TestStubs.EventStacktraceException({
      platform: 'react',
      sdk: {name: 'sentry.javascript.browser'},
    });

    render(<SetupSourceMapsAlert projectId={project.id} event={event} />, {
      organization,
    });

    expect(
      screen.getByText('Get Sentry ready for your production environment')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Setup Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/'
    );
  });

  it('show generic documentation if doc link not available', function () {
    const {project, organization} = initializeOrg();
    const event = TestStubs.EventStacktraceException({
      platform: 'unity',
    });

    render(<SetupSourceMapsAlert projectId={project.id} event={event} />, {
      organization,
    });

    expect(
      screen.getByText('Get Sentry ready for your production environment')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Setup Source Maps'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/'
    );
  });
});
