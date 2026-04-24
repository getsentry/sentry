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

  it('renders settings breadcrumbs and replaces title', () => {
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={testRoutes} params={{}} />
        <BreadcrumbTitle routes={testRoutes} title="Last Title" />
      </BreadcrumbProvider>
    );

    // Non-terminal crumbs render as links; the current page renders as
    // non-interactive text.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.getByText('Last Title')).toHaveAttribute('aria-current', 'page');
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

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveTextContent('Second Title');
    expect(screen.getByText('Last Title')).toHaveAttribute('aria-current', 'page');

    // Mutate the object so that breadcrumbTitle re-renders
    upOneRoutes = testRoutes.slice(0, -1);

    // Simulate navigating up a level, trimming the last title
    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb routes={upOneRoutes} params={{}} />
        <BreadcrumbTitle routes={upOneRoutes} title="Second Title" />
      </BreadcrumbProvider>
    );

    const linksNext = screen.getAllByRole('link');
    expect(linksNext).toHaveLength(1);
    expect(screen.getByText('Second Title')).toHaveAttribute('aria-current', 'page');
  });
});
