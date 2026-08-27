import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilterAutocomplete';
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
});
