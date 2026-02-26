import {useRef, useState} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Checkbox} from '@sentry/scraps/checkbox';
import {MenuComponents} from '@sentry/scraps/compactSelect';

import type {HybridFilterRef} from 'sentry/components/pageFilters/hybridFilter';
import {
  HybridFilter,
  useStagedCompactSelect,
} from 'sentry/components/pageFilters/hybridFilter';

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

describe('HybridFilter', () => {
  it('renders', async () => {
    function TestComponent() {
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);
      const stagedSelect = useStagedCompactSelect({
        value: [] as string[],
        defaultValue: [],
        options,
        onChange: () => {},
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
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
      const stagedSelect = useStagedCompactSelect({
        value,
        defaultValue: [],
        options,
        onChange,
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
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
      const stagedSelect = useStagedCompactSelect({
        value,
        defaultValue: [],
        options,
        onChange: newValue => {
          onChange(newValue);
          setValue(newValue);
        },
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
        />
      );
    }

    render(<ControlledHybridFilter />);

    // Clicking on the checkboxes in Option One & Option Two _adds_ the options to the
    // current selection state (multiple selection mode)
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option Two'}));
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select Option Two'})).toBeChecked();

    // Clicking "Apply" commits the selection
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['one', 'two']));

    // Ctrl-clicking on Option One & Option Two _removes_ them from the current selection
    // state (multiple selection mode)
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.keyboard('{Control>}');
    await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
    await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));
    await userEvent.keyboard('{/Control}');
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
      const stagedSelect = useStagedCompactSelect({
        value: [] as string[],
        defaultValue: [],
        options,
        onChange,
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
        />
      );
    }

    render(<TestComponent />);

    // Open the menu, select Option One
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));

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
      const [value, setValue] = useState<string[]>(['one']);
      const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
      const options = useTestOptions(hybridFilterRef);
      const stagedSelect = useStagedCompactSelect({
        value,
        defaultValue: ['one'] as string[],
        options,
        onChange: newValue => {
          onChange(newValue);
          setValue(newValue);
        },
        onReset,
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
        />
      );
    }

    render(<TestComponent />);

    // Open the menu, Reset button is not shown yet
    await userEvent.click(screen.getByRole('button', {expanded: false}));
    expect(screen.queryByRole('button', {name: 'Reset'})).not.toBeInTheDocument();

    // Select Option Two, Reset button shows up
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option Two'}));
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
      const stagedSelect = useStagedCompactSelect({
        value: [] as string[],
        defaultValue: [],
        options,
        onChange,
        multiple: true,
      });

      return (
        <HybridFilter
          search
          ref={hybridFilterRef}
          options={options}
          stagedSelect={stagedSelect}
          menuHeaderTrailingItems={
            stagedSelect.shouldShowReset ? (
              <MenuComponents.ResetButton onClick={() => stagedSelect.handleReset()} />
            ) : null
          }
          menuFooter={
            stagedSelect.hasStagedChanges ? (
              <div>
                <MenuComponents.CancelButton
                  disabled={!stagedSelect.hasStagedChanges}
                  onClick={() => stagedSelect.removeStagedChanges()}
                />
                <MenuComponents.ApplyButton
                  onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                />
              </div>
            ) : null
          }
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

    // Activate the checkbox by clicking it
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));
    expect(screen.getByRole('checkbox', {name: 'Select Option One'})).toBeChecked();

    // Click "Apply" button, onChange is called
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenCalledWith(['one']);
  });

  describe('Shift-click range selection', () => {
    it('selects range forward (first to third)', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.CancelButton
                    onClick={() => stagedSelect.removeStagedChanges()}
                  />
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click row for Option One to set anchor (works with modifier keys)
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click row for Option Three to select range
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select all items from one to three
      expect(onChange).toHaveBeenLastCalledWith(['one', 'two', 'three']);
    });

    it('selects range backward (third to first)', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click row for Option Three to set anchor (works with modifier keys)
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click row for Option One to select range backward
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select all items from one to three
      expect(onChange).toHaveBeenLastCalledWith(['one', 'two', 'three']);
    });

    it('first shift-click acts as normal click', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Shift-click row for Option Two (no previous selection)
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should only select option two
      expect(onChange).toHaveBeenLastCalledWith(['two']);
    });

    it('deselects range when shift-clicking already selected item', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>(['one', 'two', 'three']);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click row for Option One to deselect and set anchor
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click row for Option Three to deselect range
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should deselect all items from one to three
      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('keeps menu open during shift-click', async () => {
      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: setValue,
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click row for Option One (works with modifier keys)
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click row for Option Two
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));
      await userEvent.keyboard('{/Shift}');

      // Menu should still be open
      expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Apply'})).toBeInTheDocument();
    });

    it('works with rows and modifier keys', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click row for Option One to set anchor
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click row for Option Three to select range
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select all items from one to three
      expect(onChange).toHaveBeenLastCalledWith(['one', 'two', 'three']);
    });

    it('Cmd/Ctrl still works for individual toggle', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click checkbox for Option One
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option One'}));
      await userEvent.keyboard('{/Control}');

      // Ctrl-click checkbox for Option Three (should not select two)
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select Option Three'}));
      await userEvent.keyboard('{/Control}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should only select options one and three (not two)
      expect(onChange).toHaveBeenLastCalledWith(['one', 'three']);
    });

    it('resets anchor on menu open so shift+click never ranges across sessions', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // First session: open menu, ctrl+click Option One to set the anchor, apply
      await userEvent.click(screen.getByRole('button', {expanded: false}));
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Second session: reopen menu — anchor should have been cleared on open
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Shift-click Option Three — since anchor was cleared on open, this is a single toggle
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select One (from first session) and Three (single-toggled), but NOT Two.
      // Without the fix, the stale anchor 'one' would range-select [one, two, three].
      expect(onChange).toHaveBeenLastCalledWith(['one', 'three']);
    });

    it('resets anchor when search changes so next shift+click acts as single select', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Ctrl-click Option One to set the shift-click anchor
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Type in the search box — this should clear the shift-click anchor
      await userEvent.type(screen.getByRole('textbox'), 'Three');

      // Shift-click Option Three — anchor was cleared so this acts as a single select
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select One (already staged) and Three (single-toggled), but NOT Two.
      // Without the fix the shift+click would range-select [one, two, three].
      expect(onChange).toHaveBeenLastCalledWith(['one', 'three']);
    });

    it('shift+click range in filtered list only selects visible options', async () => {
      const onChange = jest.fn();

      function TestComponent() {
        const [value, setValue] = useState<string[]>([]);
        const hybridFilterRef = useRef<HybridFilterRef<string>>({toggleOption: () => {}});
        const options = useTestOptions(hybridFilterRef);
        const stagedSelect = useStagedCompactSelect({
          value,
          defaultValue: [],
          options,
          onChange: newValue => {
            onChange(newValue);
            setValue(newValue);
          },
          multiple: true,
        });

        return (
          <HybridFilter
            search
            ref={hybridFilterRef}
            options={options}
            stagedSelect={stagedSelect}
            menuFooter={
              stagedSelect.hasStagedChanges ? (
                <div>
                  <MenuComponents.ApplyButton
                    onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
                  />
                </div>
              ) : null
            }
          />
        );
      }

      render(<TestComponent />);

      // Open the menu
      await userEvent.click(screen.getByRole('button', {expanded: false}));

      // Search 'e' — matches 'Option One' and 'Option Three', but not 'Option Two'
      await userEvent.type(screen.getByRole('textbox'), 'e');

      // Ctrl-click Option One to set the anchor within the filtered list
      await userEvent.keyboard('{Control>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.keyboard('{/Control}');

      // Shift-click Option Three — range spans only the filtered options [One, Three]
      await userEvent.keyboard('{Shift>}');
      await userEvent.click(screen.getByRole('row', {name: 'Option Three'}));
      await userEvent.keyboard('{/Shift}');

      // Apply the changes
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // Should select One and Three but NOT Two (hidden by search filter)
      expect(onChange).toHaveBeenLastCalledWith(['one', 'three']);
    });
  });
});
