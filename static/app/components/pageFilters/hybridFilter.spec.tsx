import {useRef, useState} from 'react';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Checkbox} from '@sentry/scraps/checkbox';

import type {HybridFilterRef} from 'sentry/components/pageFilters/hybridFilter';
import {HybridFilter} from 'sentry/components/pageFilters/hybridFilter';

function useTestOptions(hybridFilterRef: React.RefObject<HybridFilterRef<string>>) {
  return [
    {
      value: 'one',
      label: 'Option One',
      leadingItems: ({isSelected}: {isSelected: boolean}) => (
        <Checkbox
          size="sm"
          checked={isSelected}
          onChange={() => hybridFilterRef.current?.toggleOption?.('one')}
          aria-label="Select Option One"
          tabIndex={-1}
        />
      ),
    },
    {
      value: 'two',
      label: 'Option Two',
      leadingItems: ({isSelected}: {isSelected: boolean}) => (
        <Checkbox
          size="sm"
          checked={isSelected}
          onChange={() => hybridFilterRef.current?.toggleOption?.('two')}
          aria-label="Select Option Two"
          tabIndex={-1}
        />
      ),
    },
    {
      value: 'three',
      label: 'Option Three',
      leadingItems: ({isSelected}: {isSelected: boolean}) => (
        <Checkbox
          size="sm"
          checked={isSelected}
          onChange={() => hybridFilterRef.current?.toggleOption?.('three')}
          aria-label="Select Option Three"
          tabIndex={-1}
        />
      ),
    },
  ];
}

const props = {
  searchable: true,
  multiple: true,
};

describe('ProjectPageFilter', () => {
  it('renders', async () => {
    function TestComponent() {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          value={[]}
          defaultValue={[]}
          onChange={() => {}}
        />
      );
    }

    render(<TestComponent />);

    // Open menu, search input is focused & all the options are there
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    expect(screen.getByPlaceholderText('Search…')).toHaveFocus();
    expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Option Three'})).toBeInTheDocument();
  });

  it('handles both single and multiple selection', async () => {
    const onChange = jest.fn();

    function TestComponent({value}: {value: string[]}) {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          value={value}
          defaultValue={[]}
          onChange={onChange}
        />
      );
    }

    const {rerender} = render(<TestComponent value={[]} />);

    // Clicking on Option One selects it (single selection)
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
    expect(onChange).toHaveBeenCalledWith(['one']);
    expect(screen.getByRole('button', {expanded: false})).toBeInTheDocument();

    // HybridFilter is controlled-only, so we need to rerender it with new value
    rerender(<TestComponent value={['one']} />);

    // Clicking on Option Two selects it and removes Option One from the selection state
    // (single selection mode)
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));
    expect(onChange).toHaveBeenCalledWith(['two']);
  });

  it('handles multiple selection', async () => {
    const onChange = jest.fn();
    function ControlledHybridFilter() {
      const [value, setValue] = useState<string[]>([]);
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          defaultValue={[]}
          value={value}
          onChange={newValue => {
            onChange(newValue);
            setValue(newValue);
          }}
        />
      );
    }

    render(<ControlledHybridFilter />);

    // Clicking on the checkboxes in Option One & Option Two _adds_ the options to the
    // current selection state (multiple selection mode)
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select Option Two'}));
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select Option Two'})).toBeChecked();

    // Clicking "Apply" commits the selection
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['one', 'two']));

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    // Ctrl-clicking on Option One & Option Two _removes_ them to the current selection
    // state (multiple selection mode)
    const ctrlKeyOpts = {
      key: 'Control',
      code: 'ControlLeft',
      keyCode: 17,
      which: 17,
      ctrlKey: true,
    };
    fireEvent.keyDown(screen.getByRole('grid'), ctrlKeyOpts); // Press & hold Ctrl
    await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
    fireEvent.click(screen.getByRole('row', {name: 'Option Two'}));
    fireEvent.keyUp(screen.getByRole('grid'), ctrlKeyOpts); // Release Ctrl
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select Option Two'})).not.toBeChecked();

    // Clicking "Apply" commits the selection
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('can cancel', async () => {
    const onChange = jest.fn();

    function TestComponent() {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          value={[]}
          defaultValue={[]}
          onChange={onChange}
        />
      );
    }

    render(<TestComponent />);

    // Open the menu, select Option One
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));

    // Press Cancel
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    // Open menu again
    await userEvent.click(screen.getByRole('button', {expanded: false}));

    // Option One isn't selected, onChange was never called
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can reset', async () => {
    const onChange = jest.fn();
    const onReset = jest.fn();

    function TestComponent() {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          value={['one']}
          defaultValue={['one']}
          onChange={onChange}
          onReset={onReset}
        />
      );
    }

    render(<TestComponent />);

    // Open the menu, Reset button is not shown yet
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    expect(screen.queryByRole('button', {name: 'Reset'})).not.toBeInTheDocument();

    // Select Option Two, Reset button shows up
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select Option Two'}));
    expect(screen.getByRole('checkbox', {name: 'Select Option Two'})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeInTheDocument();

    // Apply & open menu again
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    expect(screen.getByRole('button', {name: 'Reset'})).toBeInTheDocument();

    // Click Reset button, callback is called with default value
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));
    expect(onChange).toHaveBeenCalledWith(['one']);
    expect(onReset).toHaveBeenCalled();
  });

  it('supports keyboard navigation', async () => {
    const onChange = jest.fn();

    function TestComponent() {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);

      return (
        <HybridFilter
          {...props}
          ref={hybridFilterRef}
          options={options}
          value={[]}
          defaultValue={[]}
          onChange={onChange}
        />
      );
    }

    render(<TestComponent />);

    // Open the menu, focus is on search input
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search…')).toHaveFocus();
    });

    // Press Arrow Down to move focus to Option One
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus();
    });

    // Press Arrow Right to move focus to the checkbox
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: 'Select Option One'})).toHaveFocus();
    });

    // Activate the checkbox. In browsers, users can press Space when the checkbox is
    // focused to activate it. With RTL, however, onChange events aren't fired on Space
    // key press (https://github.com/testing-library/react-testing-library/issues/122),
    // so we'll have to simulate a click event instead.
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).toBeChecked();

    // Click "Apply" button, onChange is called
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenCalledWith(['one']);
  });
});
