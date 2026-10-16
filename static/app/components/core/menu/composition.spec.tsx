import {useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompactSelect, Select} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Menu} from '@sentry/scraps/menu';

describe('composed menu primitives', () => {
  it('renders labeled sections, an explicit separator, and actions', async () => {
    const onAction = jest.fn();
    render(
      <DropdownMenu triggerLabel="Actions">
        <Menu.Header>Choose an action</Menu.Header>
        <Menu.Section sectionKey="edit">
          <Menu.SectionLabel>Edit</Menu.SectionLabel>
          <Menu.Item itemKey="rename" label="Rename" onAction={onAction} />
        </Menu.Section>
        <Menu.Separator />
        <Menu.Section sectionKey="export" aria-label="Export actions">
          <Menu.Item itemKey="download" label="Download" />
        </Menu.Section>
        <Menu.Footer>More actions available later</Menu.Footer>
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
        <Menu.Submenu itemKey="export" label="Export">
          <Menu.Item itemKey="csv" label="CSV" onAction={onAction} />
        </Menu.Submenu>
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
        <Menu.Section sectionKey="export">
          <Menu.SectionLabel>Export</Menu.SectionLabel>
          <Menu.Submenu itemKey="formats" label="Choose format">
            <Menu.Item itemKey="json" label="JSON" />
          </Menu.Submenu>
        </Menu.Section>
      </DropdownMenu>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    expect(screen.getByRole('group', {name: 'Export'})).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Choose format'}));
    expect(await screen.findByRole('menuitemradio', {name: 'JSON'})).toBeInTheDocument();
  });

  it('searches composed options and keeps footer actions outside the listbox', async () => {
    function Example() {
      const [value, setValue] = useState<string>();
      return (
        <CompactSelect
          value={value}
          onChange={option => setValue(option.value)}
          search={{placeholder: 'Filter options'}}
        >
          <Menu.Section sectionKey="fruit">
            <Menu.SectionLabel>Fruit</Menu.SectionLabel>
            <Select.Item value="apple" label="Apple" />
            <Select.Item value="pear" label="Pear" />
          </Menu.Section>
          <Menu.Footer>Selection is immediate</Menu.Footer>
        </CompactSelect>
      );
    }

    render(<Example />);
    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    const listbox = screen.getByRole('listbox');
    expect(screen.getByRole('group', {name: 'Fruit'})).toBeInTheDocument();
    expect(listbox).not.toContainElement(screen.getByPlaceholderText('Filter options'));
    expect(listbox).not.toContainElement(screen.getByText('Selection is immediate'));

    await userEvent.type(screen.getByPlaceholderText('Filter options'), 'pear');
    expect(screen.queryByRole('option', {name: 'Apple'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'Pear'}));
    expect(screen.getByRole('button', {name: 'Pear'})).toBeInTheDocument();
  });
});
