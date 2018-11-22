import React from 'react';
import {mount} from 'enzyme';

import TwoFactorRequired from 'app/views/settings/account/accountSecurity/';
import AccountSecurityWrapper from 'app/views/settings/account/accountSecurity/accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const ORG_ENDPOINT = '/organizations/';

describe('TwoFactorRequired', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: false})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: false}),
    });
  });

  it('renders empty', function() {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [],
    });

    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('TwoFactorRequired')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is not required, not 2FA enrolled', function() {
    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is not required, 2FA is enrolled', function() {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });

    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(0);
  });

  it('does not render when 2FA is required, 2FA is enrolled', function() {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [TestStubs.Authenticators().Totp({isEnrolled: true})],
    });
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(0);
  });

  it('renders when 2FA is required for multiple orgs, 2FA is not enrolled', function() {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations({require2FA: true}),
    });

    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[className="require-2fa"]').text()).toEqual(
      expect.stringContaining('Test 1 and Test 2 organizations')
    );
  });

  it('renders when 2FA is required for one org, 2FA is not enrolled', function() {
    MockApiClient.addMockResponse({
      url: ORG_ENDPOINT,
      body: [
        {
          id: '1',
          name: 'test 1',
          require2FA: true,
        },
      ],
    });

    let wrapper = mount(
      <AccountSecurityWrapper>
        <TwoFactorRequired />
      </AccountSecurityWrapper>,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert[className="require-2fa"]')).toHaveLength(1);
    expect(wrapper.find('StyledAlert[className="require-2fa"]').text()).toEqual(
      expect.stringContaining('Test 1 organization')
    );
  });
});
