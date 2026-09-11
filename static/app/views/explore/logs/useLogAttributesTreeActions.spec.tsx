import type {ReactNode} from 'react';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsSidebarProvider} from 'sentry/views/explore/logs/logsSidebarContext';
import {useLogAttributesTreeActions} from 'sentry/views/explore/logs/useLogAttributesTreeActions';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsSidebarProvider value={jest.fn()}>
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        {children}
      </LogsQueryParamsProvider>
    </LogsSidebarProvider>
  );
}

describe('useLogAttributesTreeActions', () => {
  it('returns base actions for string values', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {additionalWrapper: Wrapper}
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'message',
        attribute_value: 'hello',
        original_attribute_key: 'message',
        type: 'str',
      },
      subtree: {},
      value: 'hello',
    };

    expect(result.current(content).map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
      'Add this as table column',
      'Group by attribute',
    ]);
  });

  it('returns greater/less than actions for numeric values', () => {
    const {result, router} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/explore/logs/',
            query: {},
          },
        },
      }
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'severity_number',
        attribute_value: 17,
        original_attribute_key: 'severity_number',
        type: 'int',
      },
      subtree: {},
      value: 17,
    };

    const actions = result.current(content);

    expect(actions.map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
      'Show values greater than',
      'Show values less than',
      'Add this as table column',
      'Group by attribute',
    ]);

    act(() => {
      actions.find(action => action.key === 'search-for-greater-than')?.onAction?.();
    });
    expect(router.location.query.logsQuery).toBe('severity_number:>17');

    act(() => {
      actions.find(action => action.key === 'search-for-less-than')?.onAction?.();
    });
    expect(router.location.query.logsQuery).toBe('severity_number:<17');
  });

  it('hides column and group-by actions when embedded', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: true}),
      {additionalWrapper: Wrapper}
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'message',
        attribute_value: 'hello',
        original_attribute_key: 'message',
        type: 'str',
      },
      subtree: {},
      value: 'hello',
    };

    const actions = result.current(content);
    expect(actions.find(action => action.key === 'add-column')?.hidden).toBe(true);
    expect(actions.find(action => action.key === 'add-group-by')?.hidden).toBe(true);
  });

  it('returns no actions when originalAttribute is missing', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {additionalWrapper: Wrapper}
    );

    expect(result.current({subtree: {}, value: ''})).toEqual([]);
  });
});
