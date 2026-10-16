import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {Menu} from '@sentry/scraps/menu';

describe('Menu', () => {
  it('opens from the keyboard, skips disabled items, and closes with Escape', async () => {
    render(
      <Menu>
        <Menu.Trigger>More actions</Menu.Trigger>
        <Menu.Content>
          <Menu.List aria-label="More actions">
            <Menu.ListItem label="Unavailable" disabled />
            <Menu.ListItem label="Available" />
          </Menu.List>
        </Menu.Content>
      </Menu>
    );

    screen.getByRole('button', {name: 'More actions'}).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', {name: 'More actions'})).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('menuitem', {name: 'Available'})).toHaveFocus()
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'More actions'})).toHaveFocus()
    );
  });

  it('composes a header, searchable sections, items, separator, and footer', async () => {
    const onSelect = jest.fn();

    render(
      <Menu>
        <Menu.Trigger>Choose project</Menu.Trigger>
        <Menu.Content>
          <Menu.Header title="Projects">
            <Menu.Search aria-label="Search projects" placeholder="Search projects" />
          </Menu.Header>
          <Menu.List aria-label="Projects">
            <Menu.Section>
              <Menu.SectionLabel>Favorites</Menu.SectionLabel>
              <Menu.ListItem label="Alpha" onAction={onSelect} />
              <Menu.ListItem label="Beta" />
            </Menu.Section>
            <Menu.SectionSeparator />
            <Menu.Section>
              <Menu.SectionLabel>Other projects</Menu.SectionLabel>
              <Menu.ListItem label="Gamma" />
            </Menu.Section>
          </Menu.List>
          <Menu.Footer>Manage projects</Menu.Footer>
        </Menu.Content>
      </Menu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Choose project'}));

    const search = screen.getByRole('textbox', {name: 'Search projects'});
    await waitFor(() => expect(search).toHaveFocus());
    expect(screen.getByRole('group', {name: 'Favorites'})).toBeInTheDocument();
    expect(screen.getByText('Manage projects')).toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);

    await userEvent.type(search, 'alp');
    expect(screen.getByRole('menuitem', {name: 'Alpha'})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: 'Beta'})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: 'Gamma'})).not.toBeInTheDocument();
    expect(screen.queryByRole('group', {name: 'Other projects'})).not.toBeInTheDocument();

    await userEvent.clear(search);
    expect(screen.getByRole('group', {name: 'Other projects'})).toBeInTheDocument();
    await userEvent.type(search, 'alp');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Alpha'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a searchable submenu and navigates back to its trigger', async () => {
    const onSelect = jest.fn();

    render(
      <Menu>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.List aria-label="Actions">
            <Menu.Submenu label="Projects">
              <Menu.Content>
                <Menu.Header title="Choose a project">
                  <Menu.Search aria-label="Search projects" />
                </Menu.Header>
                <Menu.List aria-label="Projects">
                  <Menu.Section>
                    <Menu.SectionLabel>Favorites</Menu.SectionLabel>
                    <Menu.ListItem label="Alpha" onAction={onSelect} />
                    <Menu.ListItem label="Beta" />
                  </Menu.Section>
                </Menu.List>
              </Menu.Content>
            </Menu.Submenu>
          </Menu.List>
        </Menu.Content>
      </Menu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    const submenu = screen.getByRole('menuitem', {name: 'Projects'});
    await waitFor(() => expect(submenu).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}');

    const projectMenu = screen.getByRole('menu', {name: 'Projects'});
    const search = within(projectMenu.parentElement!).getByRole('textbox', {
      name: 'Search projects',
    });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu', {name: 'Projects'})).not.toBeInTheDocument();
    expect(screen.getByRole('menu', {name: 'Actions'})).toBeInTheDocument();
    await waitFor(() => expect(submenu).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Search projects'})).toHaveFocus()
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Search projects'}), 'alp');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Alpha'})).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', {name: 'Projects'})).not.toBeInTheDocument();
    expect(submenu).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Search projects'})).toHaveFocus()
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Alpha'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', {name: 'Actions'})).not.toBeInTheDocument();
  });
});
