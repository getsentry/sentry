import {Modal} from 'react-bootstrap';
import React from 'react';

import {mount} from 'enzyme';
import RecoveryOptionsModal from 'app/components/modals/recoveryOptionsModal';

describe('RecoveryOptionsModal', function() {
  let closeModal = jest.fn();
  let onClose = jest.fn();
  let wrapper;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/users/me/authenticators/',
      method: 'GET',
      body: TestStubs.AllAuthenticators(),
    });
    wrapper = mount(
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

  afterEach(function() {});

  it('can redirect to recovery codes if user skips backup phone setup', async function() {
    let getRecoveryCodes = 'RecoveryOptionsModal Button[name="getCodes"]';
    expect(wrapper.find(getRecoveryCodes)).toHaveLength(0);

    // skip backup phone setup
    wrapper.find('RecoveryOptionsModal Button[name="skipStep"]').simulate('click');
    expect(wrapper.find(getRecoveryCodes)).toHaveLength(1);

    let mockId = 16;
    expect(
      wrapper.find('RecoveryOptionsModal Button[name="getCodes"]').prop('to')
    ).toMatch(`/settings/account/security/${mockId}/`);

    wrapper.find(getRecoveryCodes).simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });

  it('can redirect to backup phone setup', async function() {
    let backupPhone = 'RecoveryOptionsModal Button[name="addPhone"]';

    expect(wrapper.find(backupPhone)).toHaveLength(1);
    expect(wrapper.find(backupPhone).prop('to')).toMatch(
      '/settings/account/security/sms/enroll/'
    );

    wrapper.find(backupPhone).simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });
});
