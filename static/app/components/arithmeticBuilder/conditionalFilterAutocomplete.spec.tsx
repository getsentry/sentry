import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilterAutocomplete';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {FieldKind} from 'sentry/utils/fields';

const functionArguments = [{name: 'span.op', kind: FieldKind.TAG, label: 'span.op'}];

describe('useConditionalFilterAutocomplete', () => {
  it('does not fetch values with an empty filter key', async () => {
    const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

    const {rerender} = renderHookWithProviders(
      ({filterValue, selectionIndex}: {filterValue: string; selectionIndex: number}) =>
        useConditionalFilterAutocomplete({
          enabled: true,
          filterValue,
          functionArguments,
          getFilterTagValues,
          selectionIndex,
        }),
      {initialProps: {filterValue: '', selectionIndex: 0}}
    );

    expect(getFilterTagValues).not.toHaveBeenCalled();

    rerender({filterValue: 'span.op', selectionIndex: 6});
    expect(getFilterTagValues).not.toHaveBeenCalled();

    rerender({filterValue: 'span.op:', selectionIndex: 8});

    await waitFor(() => {
      expect(getFilterTagValues).toHaveBeenCalledWith({
        tag: expect.objectContaining({key: 'span.op'}),
        searchQuery: '',
      });
    });
    expect(getFilterTagValues).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tag: expect.objectContaining({key: ''}),
      })
    );
  });

  it('shows key suggestions when the cursor is before the colon', () => {
    const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

    const {result} = renderHookWithProviders(() =>
      useConditionalFilterAutocomplete({
        enabled: true,
        filterValue: 'span.op:db',
        functionArguments,
        getFilterTagValues,
        selectionIndex: 3,
      })
    );

    expect(result.current.items.map(item => item.label)).toEqual(['span.op:']);
    expect(getFilterTagValues).not.toHaveBeenCalled();
  });

  it('shows value suggestions when the cursor is after the colon', async () => {
    const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

    const {result} = renderHookWithProviders(() =>
      useConditionalFilterAutocomplete({
        enabled: true,
        filterValue: 'span.op:db',
        functionArguments,
        getFilterTagValues,
        selectionIndex: 10,
      })
    );

    await waitFor(() => {
      expect(getFilterTagValues).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.items.map(item => item.label)).toEqual(['db']);
    });
  });

  it('does not show previous key values while debounce catches up to a new key', async () => {
    jest.useFakeTimers();
    const getFilterTagValues = jest.fn(({tag}) => {
      if (tag.key === 'span.op') {
        return Promise.resolve([{value: 'db'}]);
      }
      if (tag.key === 'span.description') {
        return Promise.resolve([{value: 'SELECT 1'}]);
      }
      return Promise.resolve([]);
    });

    try {
      const {result, rerender} = renderHookWithProviders(
        ({filterValue, selectionIndex}: {filterValue: string; selectionIndex: number}) =>
          useConditionalFilterAutocomplete({
            enabled: true,
            filterValue,
            functionArguments: [
              {name: 'span.op', kind: FieldKind.TAG, label: 'span.op'},
              {
                name: 'span.description',
                kind: FieldKind.TAG,
                label: 'span.description',
              },
            ],
            getFilterTagValues,
            selectionIndex,
          }),
        {initialProps: {filterValue: 'span.op:', selectionIndex: 8}}
      );

      await act(() => jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DURATION));
      await waitFor(() => {
        expect(result.current.items.map(item => item.label)).toEqual(['db']);
      });

      rerender({filterValue: 'span.description:', selectionIndex: 17});
      // Immediate render still has prior query data + new filterKey — must not relabel.
      expect(result.current.items.map(item => item.label)).toEqual([]);

      await act(() => jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DURATION));
      await waitFor(() => {
        expect(result.current.items.map(item => item.label)).toEqual(['SELECT 1']);
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
