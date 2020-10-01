import {Modal} from 'react-bootstrap';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import RecoveryOptionsModal from 'app/components/modals/recoveryOptionsModal';

describe('RecoveryOptionsModal', function () {
  const closeModal = jest.fn();
  const onClose = jest.fn();
  let wrapper;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: TestStubs.AllAuthenticators(),
    });
    wrapper = mountWithTheme(
      <RecoveryOptionsModal
        Body={Modal.Body}
        Header={Modal.Header}
        authenticatorName="Authenticator App"
        closeModal={closeModal}
        onClose={onClose}
      />,
      TestStubs.routerContext()
    );
  });

  afterEach(function () {});

  it('can redirect to recovery codes if user skips backup phone setup', async function () {
    const getRecoveryCodes = 'RecoveryOptionsModal Button[name="getCodes"]';
    expect(wrapper.find(getRecoveryCodes)).toHaveLength(0);

    // skip backup phone setup
    wrapper.find('RecoveryOptionsModal Button[name="skipStep"]').simulate('click');
    expect(wrapper.find(getRecoveryCodes)).toHaveLength(1);

    const mockId = TestStubs.Authenticators().Recovery().authId;
    expect(
      wrapper.find('RecoveryOptionsModal Button[name="getCodes"]').prop('to')
    ).toMatch(`/settings/account/security/mfa/${mockId}/`);

    wrapper.find(getRecoveryCodes).simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });

  it('can redirect to backup phone setup', async function () {
    const backupPhone = 'RecoveryOptionsModal Button[name="addPhone"]';

    expect(wrapper.find(backupPhone)).toHaveLength(1);
    expect(wrapper.find(backupPhone).prop('to')).toMatch(
      '/settings/account/security/mfa/sms/enroll/'
    );

    wrapper.find(backupPhone).simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });

  it('skips backup phone setup if text message authenticator unavailable', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: [TestStubs.Authenticators().Totp(), TestStubs.Authenticators().Recovery()],
    });
    wrapper = mountWithTheme(
      <RecoveryOptionsModal
        Body={Modal.Body}
        Header={Modal.Header}
        authenticatorName="Authenticator App"
        closeModal={closeModal}
        onClose={onClose}
      />,
      TestStubs.routerContext()
    );
    const mockId = TestStubs.Authenticators().Recovery().authId;
    expect(
      wrapper.find('RecoveryOptionsModal Button[name="getCodes"]').prop('to')
    ).toMatch(`/settings/account/security/mfa/${mockId}/`);

    expect(wrapper.find('RecoveryOptionsModal Button[name="skipStep"]')).toHaveLength(0);
    expect(wrapper.find('RecoveryOptionsModal Button[name="addPhone"]')).toHaveLength(0);
  });
});
