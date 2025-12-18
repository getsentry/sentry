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
    (useNavigate as jest.Mock).mockReturnValue(navigateMock);
  });

  it('navigates with persisted fields and sortBys if missing in URL', () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/logs/',
      query: {},
    });

    (usePersistedLogsPageParams as jest.Mock).mockReturnValue([
      {
        fields: ['message', 'sentry.message.parameters.0'],
        sortBys: [{field: 'sentry.message.parameters.0', order: 'desc'}],
      },
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
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/logs/',
      query: {
        [LOGS_FIELDS_KEY]: ['level', 'timestamp'],
        [LOGS_SORT_BYS_KEY]: [{field: 'timestamp', order: 'asc'}],
      },
    });

    (usePersistedLogsPageParams as jest.Mock).mockReturnValue([
      {
        fields: ['timestamp', 'message'],
        sortBys: [{field: 'timestamp', order: 'desc'}],
      },
    ]);

    function Main() {
      usePersistentLogsPageParameters();
      return <div>main</div>;
    }

    render(<Main />);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('uses replace to navigate only on the first render', () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/logs/',
      query: {},
    });

    (usePersistedLogsPageParams as jest.Mock).mockReturnValue([
      {
        fields: ['message'],
        sortBys: [{field: 'message', order: 'desc'}],
      },
    ]);

    function Main() {
      usePersistentLogsPageParameters();
      return <div>main</div>;
    }

    const {rerender} = render(<Main />);
    expect(navigateMock).toHaveBeenCalledWith(expect.anything(), {replace: true});

    // Change the fields and sort by props to retrigger navigation
    (usePersistedLogsPageParams as jest.Mock).mockReturnValue([
      {
        fields: ['test'],
        sortBys: [{field: 'test', order: 'desc'}],
      },
    ]);

    rerender(<Main />);
    expect(navigateMock).toHaveBeenCalledWith(expect.anything(), {replace: false});
  });
});
