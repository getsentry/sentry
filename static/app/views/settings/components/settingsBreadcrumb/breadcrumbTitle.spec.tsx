import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {BreadcrumbProvider} from './context';
import {SettingsBreadcrumb} from '.';

jest.unmock('sentry/utils/recreateRoute');

const routeChildren = [
  {
    path: 'one',
    handle: {name: 'One', path: '/one/'},
    children: [
      {
        path: 'two',
        handle: {name: 'Two', path: '/two/'},
        element: <div />,
        children: [
          {
            path: 'three',
            handle: {name: 'Three', path: '/three/'},
            element: <div />,
          },
        ],
      },
    ],
  },
];

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
        <SettingsBreadcrumb params={{}} />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {
        initialRouterConfig: {
          route: '/',
          location: {pathname: '/one/two/three/'},
          children: routeChildren,
        },
      }
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');
  });

  it('cleans up routes', () => {
    const upOneRoutes = testRoutes.slice(0, -1);

    const {rerender, router} = render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
        <BreadcrumbTitle title="Second Title" />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {
        initialRouterConfig: {
          route: '/',
          location: {pathname: '/one/two/three/'},
          children: routeChildren,
        },
      }
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');

    // Simulate navigating up a level, trimming the last title
    router.navigate('/one/two/');

    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
        <BreadcrumbTitle title="Second Title" />
      </BreadcrumbProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(2);
    expect(crumbsNext[1]).toHaveTextContent('Two');
  });
});
