import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useLogsSelection} from 'sentry/views/explore/logs/selection/useLogsSelection';

const enabledOrganization = OrganizationFixture({features: ['ourlogs-selection']});
const disabledOrganization = OrganizationFixture({features: []});

describe('useLogsSelection', () => {
  it('returns undefined when the feature is disabled', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: disabledOrganization,
    });

    expect(result.current).toBeUndefined();
  });

  it('starts with no selected rows when the feature is enabled', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: enabledOrganization,
    });

    expect(result.current?.getSelectedRowIds()).toEqual([]);
  });

  it('adds the id to the selection when toggleSelectedRow is called for an unselected id', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: enabledOrganization,
    });

    act(() => {
      result.current?.toggleSelectedRow('log-1');
    });

    expect(result.current?.isRowSelected('log-1')).toBe(true);
    expect(result.current?.getSelectedRowIds()).toEqual(['log-1']);
  });

  it('removes the id from the selection when toggleSelectedRow is called for a selected id', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: enabledOrganization,
    });

    act(() => result.current?.toggleSelectedRow('log-1'));
    act(() => result.current?.toggleSelectedRow('log-1'));

    expect(result.current?.isRowSelected('log-1')).toBe(false);
    expect(result.current?.getSelectedRowIds()).toEqual([]);
  });

  it('replaces the selection when setSelectedRows is called', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: enabledOrganization,
    });

    act(() => result.current?.toggleSelectedRow('log-1'));
    act(() => result.current?.setSelectedRows(['log-2', 'log-3']));

    expect(result.current?.getSelectedRowIds()).toEqual(['log-2', 'log-3']);
  });

  it('empties the selection when clearSelectedRows is called', () => {
    const {result} = renderHookWithProviders(() => useLogsSelection(), {
      organization: enabledOrganization,
    });

    act(() => result.current?.setSelectedRows(['log-1', 'log-2']));
    act(() => result.current?.clearSelectedRows());

    expect(result.current?.getSelectedRowIds()).toEqual([]);
  });
});
