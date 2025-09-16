import {render, screen} from 'sentry-test/reactTestingLibrary';

import BreadcrumbTitle from './breadcrumbTitle';
import {BreadcrumbProvider} from './context';
import SettingsBreadcrumb from '.';

jest.unmock('sentry/utils/recreateRoute');

describe('BreadcrumbTitle', () => {
  const testRoutes = [
    {name: 'One', path: '/one/'},
    {name: 'Two', path: '/two/'},
    {name: 'Three', path: '/three/'},
  ];

  it('renders settings breadcrumbs and replaces title', () => {
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={testRoutes} params={{}} />
        <BreadcrumbTitle routes={testRoutes} title="Last Title" />
      </BreadcrumbProvider>
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toHaveTextContent('Last Title');
  });

  it('cleans up routes', () => {
    let upOneRoutes = testRoutes.slice(0, -1);

    const {rerender} = render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={testRoutes} params={{}} />
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
        <BreadcrumbTitle routes={testRoutes} title="Last Title" />
      </BreadcrumbProvider>
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(3);
    expect(crumbs[1]).toHaveTextContent('Second Title');
    expect(crumbs[2]).toHaveTextContent('Last Title');

    // Mutate the object so that breadcrumbTitle re-renders
    upOneRoutes = testRoutes.slice(0, -1);

    // Simulate navigating up a level, trimming the last title
    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={upOneRoutes} params={{}} />
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
      </BreadcrumbProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(2);
    expect(crumbsNext[1]).toHaveTextContent('Second Title');
  });
});
