import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PlatformPicker from 'sentry/components/platformPicker';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('PlatformPicker', function () {
  const baseProps = {
    platform: '',
    setPlatform: () => {},
    location: {query: {}},
  };

  it('should only render Mobile platforms under Mobile tab', function () {
    render(<PlatformPicker {...baseProps} defaultCategory="mobile" />);

    expect(screen.queryByTestId('platform-java')).not.toBeInTheDocument();
    expect(screen.getByTestId('platform-apple-ios')).toBeInTheDocument();
    expect(screen.getByTestId('platform-react-native')).toBeInTheDocument();
  });

  it('should render renderPlatformList with Python when filtered with py', function () {
    render(<PlatformPicker {...baseProps} defaultCategory="all" platform="py" />);

    expect(screen.queryByTestId('platform-java')).not.toBeInTheDocument();
    expect(screen.getByTestId('platform-python-flask')).toBeInTheDocument();
  });

  it('should render renderPlatformList with Native when filtered with c++ alias', function () {
    render(<PlatformPicker {...baseProps} defaultCategory="all" platform="c++" />);

    expect(screen.getByTestId('platform-native')).toBeInTheDocument();
  });

  it('should render renderPlatformList with community SDKs message if platform not found', function () {
    render(<PlatformPicker {...baseProps} />);

    userEvent.paste(screen.getByPlaceholderText('Filter Platforms'), 'aaaaaa');

    expect(screen.getByText("We don't have an SDK for that yet!")).toBeInTheDocument();
  });

  it('should update State.tab onClick when particular tab is clicked', function () {
    render(<PlatformPicker {...baseProps} />);

    expect(screen.getByText('Popular')).toBeInTheDocument();

    userEvent.click(screen.getByText('All'));
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'growth.platformpicker_category',
      expect.objectContaining({
        category: 'all',
      })
    );
  });

  it('should clear the platform when clear is clicked', function () {
    const props = {
      ...baseProps,
      platform: 'java',
      setPlatform: jest.fn(),
    };

    render(<PlatformPicker noAutoFilter {...props} />);

    userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(props.setPlatform).toHaveBeenCalledWith(null);
  });
});
