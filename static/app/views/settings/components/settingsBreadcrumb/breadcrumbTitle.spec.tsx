import {initializeOrg} from 'sentry-test/initializeOrg';
import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

jest.unmock('sentry/utils/recreateRoute');

describe('BreadcrumbTitle', function () {
  const testRoutes = [
    {name: 'One', path: '/one/'},
    {name: 'Two', path: '/two/'},
    {name: 'Three', path: '/three/'},
  ];

  it('renders settings breadcrumbs and replaces title', function () {
    const {routerContext} = initializeOrg({
      router: {
        routes: testRoutes,
      },
    } as any);

    render(
      <BreadcrumbContextProvider routes={testRoutes}>
        <SettingsBreadcrumb routes={testRoutes} params={{}} route={{}} />
        <BreadcrumbTitle routes={testRoutes} title="Last Title" />
      </BreadcrumbContextProvider>,
      {context: routerContext}
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');
  });

  it('cleans up routes', () => {
    const {routerContext} = initializeOrg({
      router: {
        routes: testRoutes,
      },
    } as any);

    let upOneRoutes = testRoutes.slice(0, -1);

    const {rerender} = render(
      <BreadcrumbContextProvider routes={testRoutes}>
        <SettingsBreadcrumb routes={testRoutes} params={{}} route={{}} />
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
        <BreadcrumbTitle routes={testRoutes} title="Last Title" />
      </BreadcrumbContextProvider>,
      {context: routerContext}
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[1]).toHaveTextContent('Second Title');
    expect(crumbs[2]).toHaveTextContent('Last Title');

    // Mutate the object so that breadcrumbTitle re-renders
    upOneRoutes = testRoutes.slice(0, -1);

    // Simulate navigating up a level, trimming the last title
    rerender(
      <BreadcrumbContextProvider routes={upOneRoutes}>
        <SettingsBreadcrumb routes={upOneRoutes} params={{}} route={{}} />
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
      </BreadcrumbContextProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(2);
    expect(crumbsNext[1]).toHaveTextContent('Second Title');
  });
});
