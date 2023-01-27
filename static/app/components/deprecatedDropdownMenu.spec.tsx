import type {ComponentProps} from 'react';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';

jest.useFakeTimers();

describe('dropdownMenuDeprecated', function () {
  const DeprecatedDropdownImplementation = (
    props: Partial<ComponentProps<typeof DeprecatedDropdownMenu>> = {}
  ) => {
    return (
      <DeprecatedDropdownMenu {...props}>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            {isOpen && (
              <ul {...getMenuProps({})}>
                <li>Dropdown Menu Item 1</li>
              </ul>
            )}
          </span>
        )}
      </DeprecatedDropdownMenu>
    );
  };

  it('renders', function () {
    const {container} = render(<DeprecatedDropdownImplementation />);
    expect(container).toSnapshot();
  });

  it('can toggle dropdown menu with actor', function () {
    render(<DeprecatedDropdownImplementation />);

    userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking on anything in menu', function () {
    render(<DeprecatedDropdownImplementation />);
    userEvent.click(screen.getByRole('button'));
    userEvent.click(screen.getByRole('listitem'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside of menu', async function () {
    render(
      <div data-test-id="outside-element">
        <DeprecatedDropdownImplementation />
      </div>
    );
    userEvent.click(screen.getByRole('button'));
    userEvent.click(screen.getByTestId('outside-element'));

    await waitForElementToBeRemoved(() => screen.queryByRole('listbox'));
  });

  it('closes dropdown when pressing escape', function () {
    render(<DeprecatedDropdownImplementation />);
    userEvent.click(screen.getByRole('button'));

    userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ignores "Escape" key if `closeOnEscape` is false', function () {
    render(<DeprecatedDropdownImplementation closeOnEscape={false} />);
    userEvent.click(screen.getByRole('button'));

    userEvent.keyboard('{Escape}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('keeps dropdown open when clicking on anything in menu with `keepMenuOpen` prop', function () {
    render(<DeprecatedDropdownImplementation keepMenuOpen />);
    userEvent.click(screen.getByRole('button'));
    userEvent.click(screen.getByRole('listitem'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('render prop getters all extend props and call original onClick handlers', function () {
    const rootClick = jest.fn();
    const actorClick = jest.fn();
    const menuClick = jest.fn();

    render(
      <DeprecatedDropdownMenu keepMenuOpen>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
          <span {...getRootProps({onClick: rootClick})} data-test-id="root">
            <button {...getActorProps({onClick: actorClick})} data-test-id="actor">
              Open Dropdown
            </button>
            {isOpen && (
              <ul {...getMenuProps({onClick: menuClick})} data-test-id="menu">
                <li>Dropdown Menu Item 1</li>
              </ul>
            )}
          </span>
        )}
      </DeprecatedDropdownMenu>
    );

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    userEvent.click(screen.getByTestId('root'));
    expect(rootClick).toHaveBeenCalled();

    userEvent.click(screen.getByTestId('actor'));
    expect(actorClick).toHaveBeenCalled();

    userEvent.click(screen.getByTestId('menu'));
    expect(menuClick).toHaveBeenCalled();

    expect(screen.queryByRole('listbox')).toBeInTheDocument();
  });

  it('always rendered menus should attach document event listeners only when opened', function () {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    render(
      <DeprecatedDropdownMenu alwaysRenderMenu>
        {({getRootProps, getActorProps, getMenuProps}) => (
          <span {...getRootProps({className: 'root'})}>
            <button {...getActorProps({className: 'actor'})}>Open Dropdown</button>
            <ul {...getMenuProps({className: 'menu'})}>
              <li>Dropdown Menu Item 1</li>
            </ul>
          </span>
        )}
      </DeprecatedDropdownMenu>
    );

    // Make sure this is only called when menu is open
    expect(addSpy).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button'));
    expect(addSpy).toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button'));
    expect(removeSpy).toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('does not close nested dropdown on actor clicks', function () {
    render(
      <DeprecatedDropdownMenu isNestedDropdown>
        {({getRootProps, getActorProps, getMenuProps}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            <ul {...getMenuProps({})}>
              <li data-test-id="menu-item">Dropdown Menu Item 1</li>
            </ul>
          </span>
        )}
      </DeprecatedDropdownMenu>
    );

    userEvent.hover(screen.getByRole('button'));
    expect(screen.getByTestId('menu-item')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button'));
    // Should still be visible.
    expect(screen.getByTestId('menu-item')).toBeInTheDocument();
  });
});
