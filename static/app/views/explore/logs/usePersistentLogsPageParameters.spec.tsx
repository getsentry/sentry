import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  LOGS_FIELDS_KEY,
  usePersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';

import {usePersistentLogsPageParameters} from './usePersistentLogsPageParameters';

jest.mock('sentry/utils/useLocation', () => ({
  ...jest.requireActual('sentry/utils/useLocation'),
  useLocation: jest.fn(),
}));

jest.mock('sentry/utils/useNavigate', () => ({
  ...jest.requireActual('sentry/utils/useNavigate'),
  useNavigate: jest.fn(),
}));

jest.mock('sentry/views/explore/contexts/logs/logsPageParams', () => ({
  ...jest.requireActual('sentry/views/explore/contexts/logs/logsPageParams'),
  usePersistedLogsPageParams: jest.fn(),
}));

describe('usePersistentLogsPageParameters', () => {
  const navigateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useNavigate).mockReturnValue(navigateMock);
  });

  it('navigates with persisted fields and sortBys if missing in URL', () => {
    jest
      .mocked(useLocation)
      .mockReturnValue(LocationFixture({pathname: '/logs/', query: {}}));

    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['message', 'sentry.message.parameters.0'],
        sortBys: [{field: 'sentry.message.parameters.0', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    function Main() {
      usePersistentLogsPageParameters();
      return <div>main</div>;
    }

    render(<Main />);

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          [LOGS_FIELDS_KEY]: ['message', 'sentry.message.parameters.0'],
          [LOGS_SORT_BYS_KEY]: ['sentry.message.parameters.0'],
        }),
      }),
      {replace: true}
    );
  });

  it('does not navigate if fields and sortBys are already set', () => {
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        pathname: '/logs/',
        query: {
          [LOGS_FIELDS_KEY]: ['level', 'timestamp'],
          [LOGS_SORT_BYS_KEY]: ['timestamp'],
        },
      })
    );

    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['timestamp', 'message'],
        sortBys: [{field: 'timestamp', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    function Main() {
      usePersistentLogsPageParameters();
      return <div>main</div>;
    }

    render(<Main />);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('uses replace to navigate only on the first render', () => {
    jest
      .mocked(useLocation)
      .mockReturnValue(LocationFixture({pathname: '/logs/', query: {}}));

    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['message'],
        sortBys: [{field: 'message', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    function Main() {
      usePersistentLogsPageParameters();
      return <div>main</div>;
    }

    const {rerender} = render(<Main />);
    expect(navigateMock).toHaveBeenCalledWith(expect.anything(), {replace: true});

    // Change the fields and sort by props to retrigger navigation
    jest.mocked(usePersistedLogsPageParams).mockReturnValue([
      {
        fields: ['test'],
        sortBys: [{field: 'test', kind: 'asc' as const}],
      },
      jest.fn(),
    ]);

    rerender(<Main />);
    expect(navigateMock).toHaveBeenCalledWith(expect.anything(), {replace: false});
  });
});
