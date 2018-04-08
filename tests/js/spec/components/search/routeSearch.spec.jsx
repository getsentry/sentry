import React from 'react';
import {mount} from 'enzyme';

import RouteSearch from 'app/components/search/routeSearch';

describe('RouteSearch', function() {
  let wrapper;

  it('can find a route', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<RouteSearch query="password">{mock}</RouteSearch>);

    await tick();
    wrapper.update();
    let calls = mock.mock.calls;
    expect(calls[calls.length - 1][0].results[0].item).toEqual({
      description: 'Change your account password and/or two factor authentication',
      path: '/settings/account/security/',
      resultType: 'route',
      sourceType: 'route',
      title: 'Security',
      to: '/settings/account/security/',
    });
  });

  it('does not find any form field ', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<RouteSearch query="invalid">{mock}</RouteSearch>);

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [],
      })
    );
  });
});
