import {mount} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {RouteSource} from 'app/components/search/sources/routeSource';

describe('RouteSource', function () {
  let wrapper;

  it('can find a route', async function () {
    const mock = jest.fn().mockReturnValue(null);

    const {organization, project} = initializeOrg();
    wrapper = mount(
      <RouteSource query="password" {...{organization, project}}>
        {mock}
      </RouteSource>
    );

    await tick();
    wrapper.update();
    const calls = mock.mock.calls;
    expect(calls[calls.length - 1][0].results[0].item).toEqual({
      description: 'Change your account password and/or two factor authentication',
      path: '/settings/account/security/',
      resultType: 'route',
      sourceType: 'route',
      title: 'Security',
      to: '/settings/account/security/',
    });
  });

  it('does not find any form field ', async function () {
    const mock = jest.fn().mockReturnValue(null);
    const {organization, project} = initializeOrg();
    wrapper = mount(
      <RouteSource query="invalid" {...{organization, project}}>
        {mock}
      </RouteSource>
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [],
      })
    );
  });
});
