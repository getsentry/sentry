import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  LOGS_FIELDS_KEY,
  usePersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';

import {usePersistentLogsPageParameters} from './usePersistentLogsPageParameters';

jest.mock('sentry/views/explore/contexts/logs/logsPageParams', () => ({
  ...jest.requireActual('sentry/views/explore/contexts/logs/logsPageParams'),
  usePersistedLogsPageParams: jest.fn(),
}));

describe('usePersistentLogsPageParameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates with persisted fields and sortBys if missing in URL', () => {
    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['message', 'sentry.message.parameters.0'],
        sortBys: [{field: 'sentry.message.parameters.0', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    const {router} = renderHookWithProviders(usePersistentLogsPageParameters, {
      initialRouterConfig: {location: {pathname: '/logs/', query: {}}},
    });

    expect(router.location.pathname).toBe('/logs/');
    expect(router.location.query).toEqual({
      [LOGS_FIELDS_KEY]: ['message', 'sentry.message.parameters.0'],
      [LOGS_SORT_BYS_KEY]: 'sentry.message.parameters.0',
    });
  });

  it('does not navigate if fields and sortBys are already set', () => {
    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['timestamp', 'message'],
        sortBys: [{field: 'timestamp', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    const {router} = renderHookWithProviders(usePersistentLogsPageParameters, {
      initialRouterConfig: {
        location: {
          pathname: '/logs/',
          query: {
            [LOGS_FIELDS_KEY]: ['level', 'timestamp'],
            [LOGS_SORT_BYS_KEY]: ['timestamp'],
          },
        },
      },
    });

    expect(router.location.query).toEqual({
      [LOGS_FIELDS_KEY]: ['level', 'timestamp'],
      [LOGS_SORT_BYS_KEY]: 'timestamp',
    });
  });

  it('uses replace to navigate only on the first render', () => {
    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['message'],
        sortBys: [{field: 'message', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    const {router, unmount} = renderHookWithProviders(usePersistentLogsPageParameters, {
      initialRouterConfig: {location: {pathname: '/logs/', query: {}}},
    });
    expect(router.location.query[LOGS_FIELDS_KEY]).toBe('message');

    router.navigate(-1);
    expect(router.location.query[LOGS_FIELDS_KEY]).toBe('message');

    // Change the persisted fields and sort by values to retrigger navigation
    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['test'],
        sortBys: [{field: 'test', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    router.navigate('/logs/', {replace: true});
    expect(router.location.query[LOGS_FIELDS_KEY]).toBe('test');

    unmount();
    router.navigate(-1);
    expect(router.location.query).toEqual({});
  });
});
