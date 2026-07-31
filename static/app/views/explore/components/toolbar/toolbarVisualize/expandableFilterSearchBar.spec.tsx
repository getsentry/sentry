import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ExpandableFilterSearchBar} from 'sentry/views/explore/components/toolbar/toolbarVisualize';

async function flushAnimationFrames() {
  await act(async () => {
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

describe('ExpandableFilterSearchBar', () => {
  it('expands on click and focuses the trailing free-text input', async () => {
    render(
      <ExpandableFilterSearchBar>
        <div data-test-id="search-query-builder">
          <div role="row" tabIndex={-1}>
            <input data-test-id="query-builder-input" defaultValue="span.op:db" />
          </div>
        </div>
      </ExpandableFilterSearchBar>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);

    const wrapper = input.closest('[data-expanded="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveProperty('selectionStart', 'span.op:db'.length);
  });

  it('collapses after Enter when no autocomplete menu is open', async () => {
    render(
      <ExpandableFilterSearchBar>
        <div data-test-id="search-query-builder">
          <div role="row" tabIndex={-1}>
            <input data-test-id="query-builder-input" defaultValue="" />
          </div>
        </div>
      </ExpandableFilterSearchBar>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    expect(input.closest('[data-expanded="true"]')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(input.closest('[data-expanded="true"]')).not.toBeInTheDocument();
  });

  it('stays expanded while a suggestion menu is open after blur', async () => {
    render(
      <ExpandableFilterSearchBar>
        <div data-test-id="search-query-builder">
          <div role="row" tabIndex={-1}>
            <input
              data-test-id="query-builder-input"
              role="combobox"
              aria-expanded="true"
              defaultValue=""
            />
          </div>
        </div>
      </ExpandableFilterSearchBar>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(input.closest('[data-expanded="true"]')).toBeInTheDocument();

    act(() => {
      input.blur();
    });
    await flushAnimationFrames();
    expect(input.closest('[data-expanded="true"]')).toBeInTheDocument();
  });

  it('collapses on blur when no suggestion menu is open', async () => {
    render(
      <ExpandableFilterSearchBar>
        <div data-test-id="search-query-builder">
          <div role="row" tabIndex={-1}>
            <input
              data-test-id="query-builder-input"
              role="combobox"
              aria-expanded="false"
              defaultValue=""
            />
          </div>
        </div>
      </ExpandableFilterSearchBar>
    );

    const input = screen.getByTestId('query-builder-input');
    await userEvent.click(input);
    await flushAnimationFrames();
    expect(input.closest('[data-expanded="true"]')).toBeInTheDocument();

    act(() => {
      input.blur();
    });
    await waitFor(() => {
      expect(input.closest('[data-expanded="true"]')).not.toBeInTheDocument();
    });
  });
});
