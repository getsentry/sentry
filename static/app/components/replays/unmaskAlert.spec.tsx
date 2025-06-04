import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import useUserViewedReplays from 'sentry/components/replays/useUserViewedReplays';
import localStorage from 'sentry/utils/localStorage';

import UnmaskAlert from './unmaskAlert';

jest.mock('sentry/utils/localStorage');
jest.mock('sentry/components/replays/useUserViewedReplays.tsx');

const mockGetItem = jest.mocked(localStorage.getItem);

const now = new Date('2020-01-01');

describe('UnmaskAlert', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    setMockDate(now);
  });
  afterEach(() => {
    resetMockDate();
  });

  it('should render the alert when local storage key is not set and user has viewed <= 3 replays', () => {
    jest.mocked(useUserViewedReplays).mockReturnValue({
      isPending: false,
      isError: false,
      data: {data: [ReplayRecordFixture(), ReplayRecordFixture(), ReplayRecordFixture()]},
    });
    render(<UnmaskAlert />);

    expect(screen.getByTestId('unmask-alert')).toBeVisible();
  });

  it('should not render the alert when the local storage key is set', () => {
    mockGetItem.mockImplementationOnce(() => now.getTime().toString());
    render(<UnmaskAlert />);

    expect(screen.queryByTestId('unmask-alert')).not.toBeInTheDocument();
  });

  it('should not render the alert if the user has viewed > 3 replays', () => {
    jest.mocked(useUserViewedReplays).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [
          ReplayRecordFixture(),
          ReplayRecordFixture(),
          ReplayRecordFixture(),
          ReplayRecordFixture(),
        ],
      },
    });
    render(<UnmaskAlert />);

    expect(screen.queryByTestId('unmask-alert')).not.toBeInTheDocument();
  });

  it('should be dismissable', async () => {
    jest.mocked(useUserViewedReplays).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [ReplayRecordFixture(), ReplayRecordFixture()],
      },
    });
    render(<UnmaskAlert />);

    expect(screen.getByTestId('unmask-alert')).toBeVisible();

    await userEvent.click(screen.getByLabelText('Close Alert'));

    expect(screen.queryByTestId('unmask-alert')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'replay-unmask-alert-dismissed',
        '"1577836800000"'
      )
    );
  });
});
