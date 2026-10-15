import type {ComponentProps, ReactNode} from 'react';
import {useLayoutEffect} from 'react';

import {act, render, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  IssueSelectionProvider,
  useIssueSelectionActions,
  useIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';

type SelectionState = ReturnType<typeof useIssueSelectionSummary> &
  ReturnType<typeof useIssueSelectionActions>;
type ProviderProps = Omit<ComponentProps<typeof IssueSelectionProvider>, 'children'>;

function useSelectionState(): SelectionState {
  const summary = useIssueSelectionSummary();
  const actions = useIssueSelectionActions();
  return {...summary, ...actions};
}

function SelectionProbe({onUpdate}: {onUpdate: (state: SelectionState) => void}) {
  const selectionState = useSelectionState();
  useLayoutEffect(() => {
    onUpdate(selectionState);
  }, [onUpdate, selectionState]);
  return null;
}

function renderSelectionHook(providerProps: ProviderProps) {
  return renderHook(useSelectionState, {
    wrapper: function Wrapper({children}: {children?: ReactNode}) {
      return (
        <IssueSelectionProvider {...providerProps}>{children}</IssueSelectionProvider>
      );
    },
  });
}

describe('IssueSelectionContext', () => {
  it('reconciles visible ids and preserves all-selected state for new rows', () => {
    let current: SelectionState | null = null;
    const onUpdate = (value: SelectionState) => {
      current = value;
    };
    const view = render(
      <IssueSelectionProvider visibleGroupIds={['1', '2']}>
        <SelectionProbe onUpdate={onUpdate} />
      </IssueSelectionProvider>
    );

    expect([...current!.records.entries()]).toEqual([
      ['1', false],
      ['2', false],
    ]);

    act(() => current!.toggleSelectAllVisible());

    expect([...current!.records.entries()]).toEqual([
      ['1', true],
      ['2', true],
    ]);

    view.rerender(
      <IssueSelectionProvider visibleGroupIds={['2', '3']}>
        <SelectionProbe onUpdate={onUpdate} />
      </IssueSelectionProvider>
    );

    expect([...current!.records.entries()]).toEqual([
      ['2', true],
      ['3', true],
    ]);
    expect(current!.lastSelected).toBeNull();
  });

  it('computes derived selection values from toggles', () => {
    const {result} = renderSelectionHook({visibleGroupIds: ['1', '2', '3']});

    expect(result.current.anySelected).toBe(false);
    expect(result.current.multiSelected).toBe(false);
    expect(result.current.pageSelected).toBe(false);

    act(() => result.current.toggleSelect('1'));
    expect(result.current.selectedIdsSet).toEqual(new Set(['1']));
    expect(result.current.anySelected).toBe(true);
    expect(result.current.multiSelected).toBe(false);
    expect(result.current.pageSelected).toBe(false);

    act(() => result.current.toggleSelect('2'));
    expect(result.current.selectedIdsSet).toEqual(new Set(['1', '2']));
    expect(result.current.multiSelected).toBe(true);
    expect(result.current.pageSelected).toBe(false);
  });

  it('supports shift-range selection using visible row order', () => {
    const {result} = renderSelectionHook({
      visibleGroupIds: ['10', '11', '12', '13', '14'],
    });

    act(() => result.current.toggleSelect('12'));
    act(() => result.current.shiftToggleSelect('14'));

    expect(result.current.records.get('10')).toBe(false);
    expect(result.current.records.get('11')).toBe(false);
    expect(result.current.records.get('12')).toBe(true);
    expect(result.current.records.get('13')).toBe(true);
    expect(result.current.records.get('14')).toBe(true);
    expect(result.current.lastSelected).toBe('14');
  });

  it('resets all-in-query selection when selection changes', () => {
    const {result} = renderSelectionHook({visibleGroupIds: ['1', '2']});

    act(() => result.current.setAllInQuerySelected(true));
    expect(result.current.allInQuerySelected).toBe(true);

    act(() => result.current.toggleSelect('1'));
    expect(result.current.allInQuerySelected).toBe(false);
  });
});
