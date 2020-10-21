import {browserHistory} from 'react-router';

import {mount} from 'sentry-test/enzyme';

import SsoForm from 'app/views/auth/ssoForm';

function doSso(wrapper, apiRequest) {
  wrapper.find('#id-organization').simulate('change', {target: {value: 'org123'}});

  wrapper.find('form').simulate('submit');

  expect(apiRequest).toHaveBeenCalledWith(
    '/auth/sso-locate/',
    expect.objectContaining({data: {organization: 'org123'}})
  );
}

describe('SsoForm', function () {
  const routerContext = TestStubs.routerContext();
  const api = new MockApiClient();

  it('renders', function () {
    const authConfig = {
      serverHostname: 'testserver',
    };

    const wrapper = mount(<SsoForm api={api} authConfig={authConfig} />, routerContext);

    expect(wrapper.find('.help-block').text()).toBe(
      'Your ID is the slug after the hostname. e.g. testserver/acme is acme.'
    );
  });

  it('handles errors', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Invalid org name',
      },
    });

    const authConfig = {};

    const wrapper = mount(<SsoForm api={api} authConfig={authConfig} />, routerContext);
    doSso(wrapper, mockRequest);

    await tick();
    wrapper.update();

    expect(wrapper.find('.alert').exists()).toBe(true);
  });

  it('handles success', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 200,
      body: {
        nextUri: '/next/',
      },
    });

    const authConfig = {};
    const wrapper = mount(<SsoForm api={api} authConfig={authConfig} />, routerContext);

    doSso(wrapper, mockRequest);

    await tick();

    expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'});
  });
});
