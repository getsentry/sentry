import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EmailVerificationModal from 'sentry/components/modals/emailVerificationModal';

describe('Email Verification Modal', function () {
  const routerContext = RouterContextFixture();
  it('renders', function () {
    MockApiClient.addMockResponse({
      url: '/users/me/emails/',
      body: [],
    });

    render(
      <EmailVerificationModal
        Body={(p => p.children) as any}
        Header={(p => p.children) as any}
      />,
      {context: routerContext}
    );
    const message = screen.getByText(
      'Please verify your email before taking this action',
      {exact: false}
    );
    expect(message.parentElement).toHaveTextContent(
      'Please verify your email before taking this action, or go to your email settings.'
    );
    expect(screen.getByTestId('email-settings-link')).toHaveAttribute(
      'href',
      '/settings/account/emails/'
    );
    expect(screen.getByText('Email Addresses')).toBeInTheDocument();
  });

  it('renders with action param', function () {
    const actionMessage = 'accepting the tenet';
    MockApiClient.addMockResponse({
      url: '/users/me/emails/',
      body: [],
    });

    render(
      <EmailVerificationModal
        Body={(p => p.children) as any}
        Header={(p => p.children) as any}
        actionMessage={actionMessage}
      />
    );
    const message = screen.getByText(
      'Please verify your email before accepting the tenet',
      {exact: false}
    );
    expect(message.parentElement).toHaveTextContent(
      `Please verify your email before ${actionMessage}, or go to your email settings.`
    );
  });
});
