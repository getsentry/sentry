import {mountWithTheme} from 'sentry-test/enzyme';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {trackAdhocEvent} from 'app/utils/analytics';
import OrganizationJoinRequest from 'app/views/organizationJoinRequest';

jest.mock('app/utils/analytics', () => ({
  trackAdhocEvent: jest.fn(),
}));
jest.mock('app/actionCreators/indicator');

describe('OrganizationJoinRequest', function () {
  const org = TestStubs.Organization({slug: 'test-org'});
  const endpoint = `/organizations/${org.slug}/join-request/`;

  beforeEach(function () {
    trackAdhocEvent.mockClear();
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('h3').text()).toBe('Request to Join');
    expect(wrapper.find('EmailField').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Request to Join"]').exists()).toBe(true);

    expect(trackAdhocEvent).toHaveBeenCalledWith({
      eventKey: 'join_request.viewed',
      org_slug: org.slug,
    });
  });

  it('submits', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
    });

    const wrapper = mountWithTheme(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper
      .find('input[id="email"]')
      .simulate('change', {target: {value: 'email@example.com'}});

    wrapper.find('form').simulate('submit');
    expect(postMock).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(wrapper.find('h3').text()).toBe('Request Sent');
    expect(wrapper.find('EmailField').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Request to Join"]').exists()).toBe(false);
  });

  it('errors', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
    });

    const wrapper = mountWithTheme(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper
      .find('input[id="email"]')
      .simulate('change', {target: {value: 'email@example.com'}});

    wrapper.find('form').simulate('submit');
    expect(postMock).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(addErrorMessage).toHaveBeenCalled();
    expect(wrapper.find('h3').text()).toBe('Request to Join');
    expect(wrapper.find('EmailField').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Request to Join"]').exists()).toBe(true);
  });

  it('cancels', function () {
    const spy = jest.spyOn(window.location, 'assign').mockImplementation(() => {});
    const wrapper = mountWithTheme(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.find('button[aria-label="Cancel"]').simulate('click');
    expect(spy).toHaveBeenCalledWith(`/auth/login/${org.slug}/`);
  });
});
