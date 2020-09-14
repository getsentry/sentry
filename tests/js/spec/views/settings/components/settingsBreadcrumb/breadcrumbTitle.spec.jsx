import React from 'react';

import {mount} from 'sentry-test/enzyme';

import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Crumb from 'app/views/settings/components/settingsBreadcrumb/crumb';
import SettingsBreadcrumb from 'app/views/settings/components/settingsBreadcrumb';
import SettingsBreadcrumbStore from 'app/stores/settingsBreadcrumbStore';

describe('BreadcrumbTitle', function() {
  const routes = [
    {name: 'One', path: '/one/'},
    {name: 'Two', path: '/two/'},
    {name: 'Three', path: '/three/'},
  ];

  it('renders', async function() {
    const wrapper = mount(
      <div>
        <SettingsBreadcrumb routes={routes} />;
        <BreadcrumbTitle routes={routes} title="Last Title" />
      </div>
    );

    await tick();
    wrapper.update();
    expect(
      wrapper
        .find(Crumb)
        .last()
        .text()
    ).toEqual('Last Title ');
  });

  it('cleans up routes', async function() {
    const upOneRoutes = routes.slice(0, -1);
    const breadcrumbs = mount(<SettingsBreadcrumb routes={routes} />);
    mount(
      <div>
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
        <BreadcrumbTitle routes={routes} title="Last Title" />
      </div>
    );

    await tick();
    breadcrumbs.update();

    const crumbs = breadcrumbs.find(Crumb);
    expect(crumbs.at(1).text()).toEqual('Second Title ');
    expect(crumbs.last().text()).toEqual('Last Title ');

    // Simulate navigating up a level, trimming the last title
    breadcrumbs.setProps({routes: upOneRoutes});
    await tick();
    expect(SettingsBreadcrumbStore.pathMap).toEqual({'/two/': 'Second Title'});
  });
});
