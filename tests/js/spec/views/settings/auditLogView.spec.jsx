import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

describe('OrganizationAuditLog', function () {
  const org = TestStubs.Organization();
  const ENDPOINT = `/organizations/${org.slug}/audit-logs/`;

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.AuditLogs(),
    });
  });

  it('renders', function (done) {
    const wrapper = mountWithTheme(
      <OrganizationAuditLog location={{query: ''}} params={{orgId: org.slug}} />
    );
    wrapper.setState({loading: false});
    wrapper.update();
    setTimeout(() => {
      wrapper.update();
      expect(wrapper).toSnapshot();
      done();
    });
  });

  it('displays whether an action was done by a superuser', function () {
    const wrapper = mountWithTheme(
      <OrganizationAuditLog location={{query: ''}} params={{orgId: org.slug}} />
    );
    expect(wrapper.find('div[data-test-id="actor-name"]').at(0).text()).toEqual(
      expect.stringContaining('(Sentry Staff)')
    );
    expect(wrapper.find('div[data-test-id="actor-name"]').at(1).text()).toEqual(
      expect.not.stringContaining('(Sentry Staff)')
    );
  });
});
