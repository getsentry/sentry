import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PRODUCT} from 'sentry/components/onboarding/productSelection';

import GettingStartedWithReact from './react';

describe('GettingStartedWithReact', function () {
  it('all products are selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        activeProductSelection={[PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]}
      />
    );

    // Install
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('yarn add @sentry/react'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('npm install --save @sentry/react'))
    ).toBeInTheDocument();

    // Configure
    expect(screen.getByRole('heading', {name: 'Configure'})).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('dsn: "test-dsn"'))
    ).toBeInTheDocument();

    // Verify
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Next Steps
    expect(screen.getByRole('heading', {name: 'Next Steps'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'React Features'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Source Maps'})).toBeInTheDocument();
  });

  it('performance product is not selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        activeProductSelection={[PRODUCT.SESSION_REPLAY]}
      />
    );

    // Next Steps
    expect(
      screen.getByRole('link', {name: 'Performance Monitoring'})
    ).toBeInTheDocument();
  });

  it('session replay product is not selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        activeProductSelection={[PRODUCT.PERFORMANCE_MONITORING]}
      />
    );

    // Next Steps
    expect(screen.getByRole('link', {name: 'Session Replay'})).toBeInTheDocument();
  });
});
