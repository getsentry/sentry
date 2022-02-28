import {enzymeRender} from 'sentry-test/enzyme';

import SettingsBreadcrumbStore from 'sentry/stores/settingsBreadcrumbStore';
import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Crumb from 'sentry/views/settings/components/settingsBreadcrumb/crumb';

describe('BreadcrumbTitle', function () {
  const routes = [
    {name: 'One', path: '/one/'},
    {name: 'Two', path: '/two/'},
    {name: 'Three', path: '/three/'},
  ];

  it('renders', async function () {
    const wrapper = enzymeRender(
      <div>
        <SettingsBreadcrumb routes={routes} />;
        <BreadcrumbTitle routes={routes} title="Last Title" />
      </div>
    );

    await tick();
    wrapper.update();
    expect(wrapper.find(Crumb).last().text()).toEqual('Last Title ');
  });

  it('cleans up routes', async function () {
    const upOneRoutes = routes.slice(0, -1);
    const breadcrumbs = enzymeRender(<SettingsBreadcrumb routes={routes} />);
    enzymeRender(
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
