import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import DropdownLink from 'sentry/components/dropdownLink';
import {MENU_CLOSE_DELAY} from 'sentry/constants';

describe('DropdownLink', function () {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const INPUT_1 = {
    title: 'test',
    onOpen: () => {},
    onClose: () => {},
    topLevelClasses: 'top-level-class',
    alwaysRenderMenu: true,
    menuClasses: '',
  };

  describe('renders', function () {
    it('and anchors to left by default', function () {
      const {container} = render(
        <DropdownLink {...INPUT_1}>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(container).toSnapshot();
    });

    it('and anchors to right', function () {
      const {container} = render(
        <DropdownLink {...INPUT_1} anchorRight>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(container).toSnapshot();
    });
  });

  describe('Uncontrolled', function () {
    describe('While Closed', function () {
      it('displays dropdown menu when dropdown actor button clicked', function () {
        render(
          <DropdownLink alwaysRenderMenu={false} title="test">
            <li>hi</li>
          </DropdownLink>
        );

        expect(screen.queryByText('hi')).not.toBeInTheDocument();

        // open
        userEvent.click(screen.getByText('test'));

        expect(screen.getByText('hi')).toBeInTheDocument();
      });
    });

    describe('While Opened', function () {
      it('closes when clicked outside', async function () {
        render(
          <div data-test-id="outside-element">
            <DropdownLink title="test" alwaysRenderMenu={false}>
              <li>hi</li>
            </DropdownLink>
          </div>
        );

        // Open menu
        userEvent.click(screen.getByText('test'));

        // Click outside
        userEvent.click(screen.getByTestId('outside-element'));

        await waitForElementToBeRemoved(() => screen.getByText('hi'));
      });

      it('closes when dropdown actor button is clicked', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        userEvent.click(screen.getByText('test'));

        // Click again
        userEvent.click(screen.getByText('test'));

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });

      it('closes when dropdown menu item is clicked', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        userEvent.click(screen.getByText('test'));

        userEvent.click(screen.getByText('hi'));

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });

      it('does not close when menu is clicked and `keepMenuOpen` is on', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} keepMenuOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        userEvent.click(screen.getByText('test'));

        // Click again
        userEvent.click(screen.getByText('test'));

        expect(screen.getByText('test')).toBeInTheDocument();
      });
    });
  });

  describe('Controlled', function () {
    describe('Opened', function () {
      it('does not close when menu is clicked', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Click option
        userEvent.click(screen.getByText('hi'));

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });

      it('does not close when document is clicked', function () {
        render(
          <div data-test-id="outside-element">
            <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
              <li>hi</li>
            </DropdownLink>
          </div>
        );

        // Click outside
        userEvent.click(screen.getByTestId('outside-element'));

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });

      it('does not close when dropdown actor is clicked', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Click menu
        userEvent.click(screen.getByText('test'));

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });
    });
    describe('Closed', function () {
      it('does not open when dropdown actor is clicked', function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Click menu
        userEvent.click(screen.getByText('test'));

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });
    });
  });

  describe('Nested Dropdown', function () {
    const NestedDropdown = () => {
      return (
        <DropdownLink title="parent" alwaysRenderMenu={false}>
          <li>
            <DropdownLink alwaysRenderMenu={false} title="nested" isNestedDropdown>
              <li>
                <DropdownLink alwaysRenderMenu={false} title="nested #2" isNestedDropdown>
                  <li>Hello</li>
                </DropdownLink>
              </li>
            </DropdownLink>
          </li>
          <li id="no-nest">Item 2</li>
        </DropdownLink>
      );
    };

    it('closes when top-level actor is clicked', function () {
      render(<NestedDropdown />);

      // Open menu
      userEvent.click(screen.getByText('parent'));

      // Close menu
      userEvent.click(screen.getByText('parent'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Opens / closes on mouse enter and leave', async function () {
      render(<NestedDropdown />);

      // Open menu
      userEvent.click(screen.getByText('parent'));

      userEvent.hover(screen.getByText('nested'));

      await screen.findByText('nested #2');

      // Leaving Nested Menu
      userEvent.unhover(screen.getByText('nested'));

      // Nested menus have close delay
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);

      // Re-entering nested menu will cancel close
      userEvent.hover(screen.getByText('nested'));
      jest.advanceTimersByTime(2);
      expect(screen.getByText('nested #2')).toBeInTheDocument();

      // Re-entering an actor will also cancel close
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);

      jest.advanceTimersByTime(2);
      userEvent.hover(screen.getByText('parent'));
      expect(screen.getByText('nested #2')).toBeInTheDocument();

      // Leave menu
      userEvent.unhover(screen.getByText('nested'));
      jest.runAllTimers();
      expect(screen.queryByText('nested #2')).not.toBeInTheDocument();
    });

    it('does not close when nested actors are clicked', async function () {
      render(<NestedDropdown />);

      // Open menu
      userEvent.click(screen.getByText('parent'));

      userEvent.click(screen.getByText('nested'));

      expect(screen.getByRole('listbox')).toBeInTheDocument();

      userEvent.hover(screen.getByText('nested'));

      userEvent.click(await screen.findByText('nested #2'));

      expect(screen.getAllByRole('listbox')).toHaveLength(2);
    });

    it('closes when terminal nested actor is clicked', async function () {
      render(<NestedDropdown />);

      // Open menu
      userEvent.click(screen.getByText('parent'));

      userEvent.hover(screen.getByText('nested'));

      userEvent.hover(await screen.findByText('nested #2'));

      userEvent.click(await screen.findByText('Hello'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
