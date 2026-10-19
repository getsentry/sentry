import {useState} from 'react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {Menu} from '@sentry/scraps/menu';

function CheckboxMenu() {
  const [checked, setChecked] = useState(false);
  return (
    <Menu.Root>
      <Menu.Trigger>Choose options</Menu.Trigger>
      <Menu.Content>
        <Menu.List aria-label="Options">
          <Menu.CheckboxItem
            label="Include details"
            checked={checked}
            onChange={setChecked}
          />
        </Menu.List>
      </Menu.Content>
    </Menu.Root>
  );
}

describe('Menu', () => {
  it('toggles checkbox items without closing the menu', async () => {
    render(<CheckboxMenu />);

    await userEvent.click(screen.getByRole('button', {name: 'Choose options'}));
    const item = screen.getByRole('menuitemcheckbox', {name: 'Include details'});
    expect(item).not.toBeChecked();

    await userEvent.click(item);
    expect(item).toBeChecked();
    expect(screen.getByRole('menu', {name: 'Options'})).toBeInTheDocument();

    item.focus();
    await userEvent.keyboard(' ');
    expect(item).not.toBeChecked();
  });

  it('requires search to be inside the header', () => {
    expect(() =>
      render(
        <Menu.Root defaultOpen>
          <Menu.Content>
            <Menu.Search aria-label="Search" />
          </Menu.Content>
        </Menu.Root>
      )
    ).toThrow('Menu.Search must be used inside Menu.Header');
  });

  it('opens from the keyboard, skips disabled items, and closes with Escape', async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>More actions</Menu.Trigger>
        <Menu.Content>
          <Menu.List aria-label="More actions">
            <Menu.ListItem label="Unavailable" disabled />
            <Menu.ListItem label="Available" />
          </Menu.List>
        </Menu.Content>
      </Menu.Root>
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

  it('moves between enabled items with arrow and Home/End keys', async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Navigate actions</Menu.Trigger>
        <Menu.Content>
          <Menu.List aria-label="Navigate actions">
            <Menu.ListItem label="First" />
            <Menu.ListItem label="Unavailable" disabled />
            <Menu.ListItem label="Last" />
          </Menu.List>
        </Menu.Content>
      </Menu.Root>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Navigate actions'}));
    await waitFor(() =>
      expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus()
    );

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Last'})).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', {name: 'Last'})).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus();
  });

  it('composes a header, searchable sections, items, separator, and footer', async () => {
    const onSelect = jest.fn();

    render(
      <Menu.Root>
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
      </Menu.Root>
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
      <Menu.Root>
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
      </Menu.Root>
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
