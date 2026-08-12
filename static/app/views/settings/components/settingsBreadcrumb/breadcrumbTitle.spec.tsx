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

    expect(crumbs).toHaveLength(2);
    expect(screen.getByText('Last Title')).toBeInTheDocument();
  });

  it('cleans up routes', () => {
    const {rerender, router} = render(
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

    expect(crumbs).toHaveLength(2);
    expect(screen.getByText('Last Title')).toBeInTheDocument();

    // Simulate navigating up a level, trimming the last title
    router.navigate('/one/two/');

    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
      </BreadcrumbProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(1);
    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});
