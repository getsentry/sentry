import type {PropsWithChildren} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EmailVerificationModal from 'sentry/components/modals/emailVerificationModal';

describe('Email Verification Modal', function () {
  it('renders', function () {
    MockApiClient.addMockResponse({
      url: '/users/me/emails/',
      body: [],
    });

    render(
      <EmailVerificationModal
        Body={((p: PropsWithChildren) => p.children) as any}
        Header={((p: PropsWithChildren) => p.children) as any}
      />
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
        Body={((p: any) => p.children) as any}
        Header={((p: any) => p.children) as any}
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
