import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {BreadcrumbProvider} from './context';
import {SettingsBreadcrumb} from '.';

jest.unmock('sentry/utils/recreateRoute');

describe('BreadcrumbTitle', () => {
  const testRoutes = [
    {name: 'One', path: '/one/'},
    {name: 'Two', path: '/two/'},
    {name: 'Three', path: '/three/'},
  ];

  const routerConfig = {
    location: {pathname: '/one/two/three'},
    route: '/one',
    children: [
      {
        path: 'two',
        handle: {path: '/two/', name: 'Two'},
        children: [
          {
            path: 'three',
            handle: {path: '/three/', name: 'Three'},
          },
        ],
      },
    ],
  };

  it('renders settings breadcrumbs and replaces title', () => {
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={testRoutes} params={{}} />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {initialRouterConfig: routerConfig}
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');
  });

  it('cleans up routes', () => {
    const upOneRoutes = testRoutes.slice(0, -1);

    const {rerender} = render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={testRoutes} params={{}} />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {initialRouterConfig: routerConfig}
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');

    // Simulate navigating up a level, trimming the last title
    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={upOneRoutes} params={{}} />
      </BreadcrumbProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(2);
    expect(crumbsNext[1]).toHaveTextContent('Two');
  });
});
