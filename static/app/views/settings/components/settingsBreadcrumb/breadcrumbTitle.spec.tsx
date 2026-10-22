import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {SettingsBreadcrumbsContext} from './context';

describe('BreadcrumbTitle', () => {
  it('combines layout parents with page items and a typed title', () => {
    render(
      <SettingsBreadcrumbsContext
        value={[{type: 'link', label: 'Settings', to: '/settings/'}]}
      >
        <BreadcrumbTitle
          title={{type: 'page-title', label: 'Workspace'}}
          breadcrumbs={[{type: 'link', label: 'Configurations', to: '/configurations/'}]}
        />
      </SettingsBreadcrumbsContext>
    );
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'Settings',
      'Configurations',
    ]);
    const heading = screen.getByRole('heading', {name: 'Workspace', level: 1});
    expect(within(heading).queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a page-owned title without a layout', () => {
    const {rerender} = render(<BreadcrumbTitle title="First title" />);
    expect(screen.getByRole('heading', {name: 'First title'})).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    rerender(<BreadcrumbTitle title="Second title" />);
    expect(screen.getByRole('heading', {name: 'Second title'})).toBeInTheDocument();
    expect(screen.queryByText('First title')).not.toBeInTheDocument();
  });
});
