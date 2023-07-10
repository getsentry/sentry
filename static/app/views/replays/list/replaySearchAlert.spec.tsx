import {browserHistory} from 'react-router';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {ReplaySearchAlert} from 'sentry/views/replays/list/replaySearchAlert';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useDismissAlert');
jest.mock('react-router');

const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;
const mockUseDismissAlert = useDismissAlert as jest.MockedFunction<
  typeof useDismissAlert
>;

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

function getMockContext() {
  return TestStubs.routerContext([{}]);
}

describe('ReplaySearchAlert', () => {
  beforeEach(() => {
    mockUseDismissAlert.mockReturnValue({
      dismiss: () => {},
      isDismissed: false,
    });
    mockUseLocation.mockReturnValue({
      pathname: '',
      query: {},
      search: '',
      key: '',
      state: {},
      action: 'PUSH',
      hash: '',
    });
  });

  it('should render search alert by w/ Try Now CTA by default', () => {
    const {container} = render(<ReplaySearchAlert needSdkUpdates={false} />, {
      context: getMockContext(),
    });
    expect(container).not.toBeEmptyDOMElement();
    expect(container).toHaveTextContent('Try Now');
  });

  it('should render Learn More CTA if SDK requires update', () => {
    const {container} = render(<ReplaySearchAlert needSdkUpdates />, {
      context: getMockContext(),
    });

    expect(container).toHaveTextContent('Learn More');
  });

  it('should push location.query and dismiss when clicking Try Now CTA', async () => {
    const dismiss = jest.fn();
    mockUseDismissAlert.mockReturnValue({
      dismiss,
      isDismissed: false,
    });
    const {container} = render(<ReplaySearchAlert needSdkUpdates={false} />, {
      context: getMockContext(),
    });
    expect(container).toHaveTextContent('Try Now');
    const tryNowButton = await screen.findByText('Try Now');
    await userEvent.click(tryNowButton);
    expect(dismiss).toHaveBeenCalled();
    expect(mockBrowserHistoryPush).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          query: 'click.tag:button',
        },
      })
    );
  });

  it('should render nothing if dismissed', () => {
    mockUseDismissAlert.mockReturnValue({
      dismiss: () => {},
      isDismissed: true,
    });

    const {container} = render(<ReplaySearchAlert needSdkUpdates={false} />, {
      context: getMockContext(),
    });
    expect(container).toBeEmptyDOMElement();
  });
});
