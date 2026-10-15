import {useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {
  ListItem,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuSearchField,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from '@sentry/scraps/menu';

describe('composed menu primitives', () => {
  it('renders labeled sections, an explicit separator, and actions', async () => {
    const onAction = jest.fn();
    render(
      <DropdownMenu triggerLabel="Actions">
        <MenuHeader>Choose an action</MenuHeader>
        <MenuSection sectionKey="edit">
          <MenuSectionLabel>Edit</MenuSectionLabel>
          <MenuItem itemKey="rename" label="Rename" onAction={onAction} />
        </MenuSection>
        <MenuSectionSeparator />
        <MenuSection sectionKey="export" aria-label="Export actions">
          <MenuItem itemKey="download" label="Download" />
        </MenuSection>
        <MenuFooter>More actions available later</MenuFooter>
      </DropdownMenu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('group', {name: 'Edit'})).toBeInTheDocument();
    expect(screen.getByRole('group', {name: 'Export actions'})).toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByText('More actions available later')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Rename'}));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('opens a composed submenu from a portalled root and restores focus', async () => {
    const onAction = jest.fn();
    render(
      <DropdownMenu triggerLabel="Actions" usePortal>
        <Submenu itemKey="export" label="Export">
          <MenuItem itemKey="csv" label="CSV" onAction={onAction} />
        </Submenu>
      </DropdownMenu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    const trigger = screen.getByRole('menuitemradio', {name: 'Export'});
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByRole('menuitemradio', {name: 'CSV'})).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menuitemradio', {name: 'CSV'})).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.hover(trigger);
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'CSV'}));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports a submenu inside a labeled section', async () => {
    render(
      <DropdownMenu triggerLabel="Actions">
        <MenuSection sectionKey="export">
          <MenuSectionLabel>Export</MenuSectionLabel>
          <Submenu itemKey="formats" label="Choose format">
            <MenuItem itemKey="json" label="JSON" />
          </Submenu>
        </MenuSection>
      </DropdownMenu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    expect(screen.getByRole('group', {name: 'Export'})).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Choose format'}));
    expect(await screen.findByRole('menuitemradio', {name: 'JSON'})).toBeInTheDocument();
  });

  it('keeps header search and footer actions outside the listbox', async () => {
    function Example() {
      const [query, setQuery] = useState('');
      const [value, setValue] = useState<string>();
      return (
        <CompactSelect value={value} onChange={option => setValue(option.value)}>
          <MenuHeader>
            <MenuSearchField
              aria-label="Filter options"
              value={query}
              onChange={setQuery}
            />
          </MenuHeader>
          <MenuSection sectionKey="fruit">
            <MenuSectionLabel>Fruit</MenuSectionLabel>
            {'Apple'.toLowerCase().includes(query.toLowerCase()) && (
              <ListItem value="apple" label="Apple" />
            )}
            {'Pear'.toLowerCase().includes(query.toLowerCase()) && (
              <ListItem value="pear" label="Pear" />
            )}
          </MenuSection>
          <MenuFooter>Selection is immediate</MenuFooter>
        </CompactSelect>
      );
    }

    render(<Example />);
    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    const listbox = screen.getByRole('listbox');
    expect(screen.getByRole('group', {name: 'Fruit'})).toBeInTheDocument();
    expect(listbox).not.toContainElement(
      screen.getByRole('textbox', {name: 'Filter options'})
    );
    expect(listbox).not.toContainElement(screen.getByText('Selection is immediate'));

    await userEvent.type(screen.getByRole('textbox', {name: 'Filter options'}), 'pear');
    expect(screen.queryByRole('option', {name: 'Apple'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'Pear'}));
    expect(screen.getByRole('button', {name: 'Pear'})).toBeInTheDocument();
  });
});
