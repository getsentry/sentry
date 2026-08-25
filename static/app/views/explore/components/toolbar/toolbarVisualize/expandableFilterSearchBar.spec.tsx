import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ExpandableFilterSearchBar} from 'sentry/views/explore/components/toolbar/toolbarVisualize/expandableFilterSearchBar';

/**
 * Collapsing is deferred by two frames so it happens after the menu close and focus
 * handoff have settled.
 */
async function flushAnimationFrames() {
  await act(async () => {
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

function SearchBarStub({
  children,
  ...inputProps
}: {
  children?: React.ReactNode;
} & React.ComponentProps<'input'>) {
  return (
    <ExpandableFilterSearchBar>
      <div data-test-id="search-query-builder">
        <div role="row" tabIndex={-1}>
          <input data-test-id="query-builder-input" {...inputProps} />
        </div>
        {children}
      </div>
    </ExpandableFilterSearchBar>
  );
}

function isExpanded(input: HTMLElement) {
  return Boolean(input.closest('[data-expanded="true"]'));
}

describe('ExpandableFilterSearchBar', () => {
  it('expands on click and puts the caret at the end of the query', async () => {
    render(<SearchBarStub defaultValue="span.op:db" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);

    expect(isExpanded(input)).toBe(true);
    expect(input).toHaveFocus();
    expect(input).toHaveProperty('selectionStart', 'span.op:db'.length);
  });

  it('collapses on Enter when no suggestion menu is open', async () => {
    render(<SearchBarStub defaultValue="" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    // Wait for the post-click focus RAF so it cannot re-expand after Enter.
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(isExpanded(input)).toBe(false);
    });
  });

  it('stays expanded on Enter while a suggestion menu is open', async () => {
    render(<SearchBarStub defaultValue="" role="combobox" aria-expanded="true" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    await userEvent.keyboard('{Enter}');
    expect(isExpanded(input)).toBe(true);
  });

  it('stays expanded after blur while a suggestion menu is open', async () => {
    render(<SearchBarStub defaultValue="" role="combobox" aria-expanded="true" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    act(() => input.blur());
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);
  });

  it('collapses after blur when no suggestion menu is open', async () => {
    render(<SearchBarStub defaultValue="" role="combobox" aria-expanded="false" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    act(() => input.blur());
    await waitFor(() => {
      expect(isExpanded(input)).toBe(false);
    });
  });

  it('leaves pointer events on autocomplete options alone', async () => {
    const onPointerDown = jest.fn();

    render(
      <SearchBarStub defaultValue="">
        {/* Menus render inside the wrapper whenever they are not portaled. */}
        <div data-overlay>
          <ul role="listbox">
            <li role="option" onPointerDown={onPointerDown}>
              span.op
            </li>
          </ul>
        </div>
      </SearchBarStub>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    expect(isExpanded(input)).toBe(true);

    await userEvent.click(screen.getByRole('option', {name: 'span.op'}));

    // Options are selected on pointer up, so the pointer sequence must reach the option
    // and must not be prevented.
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerDown.mock.calls[0]![0].defaultPrevented).toBe(false);
  });
});
