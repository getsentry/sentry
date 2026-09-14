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

function EquationBuilderStub({
  children,
  ...inputProps
}: {
  children?: React.ReactNode;
} & React.ComponentProps<'input'>) {
  return (
    <ExpandableFilterSearchBar>
      <div data-test-id="arithmetic-builder">
        <div role="row" tabIndex={-1}>
          <input data-test-id="arithmetic-builder-input" {...inputProps} />
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

  it('expands the equation builder and puts the caret at the end of the query', async () => {
    render(<EquationBuilderStub defaultValue="avg_if(span.duration,span.op,db)" />);

    const input = screen.getByTestId('arithmetic-builder-input');
    await userEvent.click(input);

    expect(isExpanded(input)).toBe(true);
    expect(input).toHaveFocus();
    expect(input).toHaveProperty(
      'selectionStart',
      'avg_if(span.duration,span.op,db)'.length
    );
  });

  it('collapses on Enter when no suggestion menu is open', async () => {
    render(<SearchBarStub defaultValue="" />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    // Wait for the post-click focus RAF so it cannot re-expand after Enter.
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    await userEvent.keyboard('{Enter}');
    await flushAnimationFrames();
    await waitFor(() => {
      expect(isExpanded(input)).toBe(false);
    });
  });

  it('lets the focused input handle Enter before collapsing', async () => {
    const onKeyDown = jest.fn();
    render(<SearchBarStub defaultValue="" onKeyDown={onKeyDown} />);

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();

    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({key: 'Enter', defaultPrevented: false})
    );
    await flushAnimationFrames();
    await waitFor(() => {
      expect(isExpanded(input)).toBe(false);
    });
  });

  it('collapses the equation builder on Enter when no suggestion is highlighted', async () => {
    render(
      <EquationBuilderStub
        defaultValue=""
        role="combobox"
        aria-expanded="true"
        aria-controls="equation-listbox"
      >
        <ul id="equation-listbox" role="listbox">
          <li role="option">avg</li>
        </ul>
      </EquationBuilderStub>
    );

    const input = screen.getByTestId('arithmetic-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    // Suggestions may be open without a highlight — Enter dismisses after commit.
    await userEvent.keyboard('{Enter}');
    await flushAnimationFrames();
    await waitFor(() => {
      expect(isExpanded(input)).toBe(false);
    });
  });

  it('stays expanded on Enter while a suggestion is highlighted', async () => {
    render(
      <SearchBarStub
        defaultValue=""
        role="combobox"
        aria-expanded="true"
        aria-activedescendant="option-1"
        aria-controls="listbox-1"
      >
        <ul id="listbox-1" role="listbox">
          <li id="option-1" role="option">
            span.op
          </li>
        </ul>
      </SearchBarStub>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(isExpanded(input)).toBe(true);

    await userEvent.keyboard('{Enter}');
    expect(isExpanded(input)).toBe(true);
  });

  it('stays expanded after blur while a suggestion menu is open', async () => {
    render(
      <SearchBarStub
        defaultValue=""
        role="combobox"
        aria-expanded="true"
        aria-controls="listbox-1"
      >
        <ul id="listbox-1" role="listbox">
          <li role="option">span.op</li>
        </ul>
      </SearchBarStub>
    );

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
