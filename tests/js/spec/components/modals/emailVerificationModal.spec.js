import {mountWithTheme} from 'sentry-test/enzyme';

import EmailVerificationModal from 'sentry/components/modals/emailVerificationModal.tsx';

describe('Email Verification Modal', function () {
  let wrapper;
  beforeEach(function () {
    wrapper = mountWithTheme(
      <EmailVerificationModal Body={p => p.children} Header={p => p.children} />
    );
  });

  it('renders', async function () {
    expect(wrapper.find('TextBlock').text()).toEqual(
      'Please verify your email before taking this action, or go to your email settings.'
    );
    expect(
      wrapper.find('Link[data-test-id="email-settings-link"]').first().props('to').to
    ).toEqual('/settings/account/emails/');
    expect(wrapper.find('EmailAddresses')).toHaveLength(1);
  });

  it('renders with action param', async function () {
    wrapper = mountWithTheme(
      <EmailVerificationModal
        Body={p => p.children}
        Header={p => p.children}
        actionMessage="accepting the tenet"
      />
    );
    expect(wrapper.find('TextBlock').text()).toEqual(
      'Please verify your email before accepting the tenet, or go to your email settings.'
    );
  });
});
