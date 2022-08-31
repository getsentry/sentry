import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';

describe('DropdownAutoComplete', function () {
  const items = [
    {
      value: 'apple',
      label: <div>Apple</div>,
    },
    {
      value: 'bacon',
      label: <div>Bacon</div>,
    },
    {
      value: 'corn',
      label: <div>Corn</div>,
    },
  ];

  it('has actor wrapper', function () {
    render(
      <DropdownAutoComplete items={items}>{() => 'Click Me!'}</DropdownAutoComplete>
    );

    expect(screen.getByRole('button')).toHaveTextContent('Click Me!');
  });

  it('does not allow the dropdown to be closed without allowActorToggle', function () {
    render(
      <DropdownAutoComplete items={items}>{() => 'Click Me!'}</DropdownAutoComplete>
    );

    const actor = screen.getByRole('button');

    // Starts closed
    expect(actor).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Clicking once opens the menu
    userEvent.click(actor);
    expect(actor).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Clicking again does not close the menu
    userEvent.click(actor);
    expect(actor).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('toggles dropdown menu when actor is clicked and allowActorToggle=true', function () {
    render(
      <DropdownAutoComplete allowActorToggle items={items}>
        {() => 'Click Me!'}
      </DropdownAutoComplete>
    );
    const actor = screen.getByRole('button');

    // Clicking once opens
    userEvent.click(actor);
    expect(actor).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Clicking again closes
    userEvent.click(actor);
    expect(actor).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
