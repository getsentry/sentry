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
      render(
        <DropdownLink {...INPUT_1}>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );
    });

    it('and anchors to right', function () {
      render(
        <DropdownLink {...INPUT_1} anchorRight>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );
    });
  });

  describe('Uncontrolled', function () {
    describe('While Closed', function () {
      it('displays dropdown menu when dropdown actor button clicked', async function () {
        render(
          <DropdownLink alwaysRenderMenu={false} title="test">
            <li>hi</li>
          </DropdownLink>
        );

        expect(screen.queryByText('hi')).not.toBeInTheDocument();

        // open
        await userEvent.click(screen.getByText('test'), {delay: null});

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
        await userEvent.click(screen.getByText('test'), {delay: null});

        // Click outside
        await userEvent.click(screen.getByTestId('outside-element'), {delay: null});

        await waitForElementToBeRemoved(() => screen.queryByText('hi'));
      });

      it('closes when dropdown actor button is clicked', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        await userEvent.click(screen.getByText('test'), {delay: null});

        // Click again
        await userEvent.click(screen.getByText('test'), {delay: null});

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });

      it('closes when dropdown menu item is clicked', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        await userEvent.click(screen.getByText('test'), {delay: null});

        await userEvent.click(screen.getByText('hi'), {delay: null});

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });

      it('does not close when menu is clicked and `keepMenuOpen` is on', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} keepMenuOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Open menu
        await userEvent.click(screen.getByText('test'), {delay: null});

        // Click again
        await userEvent.click(screen.getByText('test'), {delay: null});

        expect(screen.getByText('test')).toBeInTheDocument();
      });
    });
  });

  describe('Controlled', function () {
    describe('Opened', function () {
      it('does not close when menu is clicked', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Click option
        await userEvent.click(screen.getByText('hi'), {delay: null});

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });

      it('does not close when document is clicked', async function () {
        render(
          <div data-test-id="outside-element">
            <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
              <li>hi</li>
            </DropdownLink>
          </div>
        );

        // Click outside
        await userEvent.click(screen.getByTestId('outside-element'), {delay: null});

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });

      it('does not close when dropdown actor is clicked', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen>
            <li>hi</li>
          </DropdownLink>
        );

        // Click menu
        await userEvent.click(screen.getByText('test'), {delay: null});

        // Should still be open
        expect(screen.getByText('hi')).toBeInTheDocument();
      });
    });
    describe('Closed', function () {
      it('does not open when dropdown actor is clicked', async function () {
        render(
          <DropdownLink title="test" alwaysRenderMenu={false} isOpen={false}>
            <li>hi</li>
          </DropdownLink>
        );

        // Click menu
        await userEvent.click(screen.getByText('test'), {delay: null});

        expect(screen.queryByText('hi')).not.toBeInTheDocument();
      });
    });
  });

  describe('Nested Dropdown', function () {
    function NestedDropdown() {
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
    }

    it('closes when top-level actor is clicked', async function () {
      render(<NestedDropdown />);

      // Open menu
      await userEvent.click(screen.getByText('parent'), {delay: null});

      // Close menu
      await userEvent.click(screen.getByText('parent'), {delay: null});

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Opens / closes on mouse enter and leave', async function () {
      render(<NestedDropdown />);

      // Open menu
      await userEvent.click(screen.getByText('parent'), {delay: null});

      await userEvent.hover(screen.getByText('nested'), {delay: null});

      await screen.findByText('nested #2');

      // Leaving Nested Menu
      await userEvent.unhover(screen.getByText('nested'), {delay: null});

      // Nested menus have close delay
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);

      // Re-entering nested menu will cancel close
      await userEvent.hover(screen.getByText('nested'), {delay: null});
      jest.advanceTimersByTime(2);
      expect(screen.getByText('nested #2')).toBeInTheDocument();

      // Re-entering an actor will also cancel close
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);

      jest.advanceTimersByTime(2);
      await userEvent.hover(screen.getByText('parent'), {delay: null});
      expect(screen.getByText('nested #2')).toBeInTheDocument();

      // Leave menu
      await userEvent.unhover(screen.getByText('nested'), {delay: null});
      jest.runAllTimers();
      expect(screen.queryByText('nested #2')).not.toBeInTheDocument();
    });

    it('does not close when nested actors are clicked', async function () {
      render(<NestedDropdown />);

      // Open menu
      await userEvent.click(screen.getByText('parent'), {delay: null});

      await userEvent.click(screen.getByText('nested'), {delay: null});

      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await userEvent.hover(screen.getByText('nested'), {delay: null});

      await userEvent.click(await screen.findByText('nested #2'), {delay: null});

      expect(screen.getAllByRole('listbox')).toHaveLength(2);
    });

    it('closes when terminal nested actor is clicked', async function () {
      render(<NestedDropdown />);

      // Open menu
      await userEvent.click(screen.getByText('parent'), {delay: null});

      await userEvent.hover(screen.getByText('nested'), {delay: null});

      await userEvent.hover(await screen.findByText('nested #2'), {delay: null});

      await userEvent.click(await screen.findByText('Hello'), {delay: null});

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
