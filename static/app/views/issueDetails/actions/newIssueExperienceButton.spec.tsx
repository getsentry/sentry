import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';

jest.mock('sentry/utils/analytics');

const mockFeedbackForm = jest.fn();
jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => mockFeedbackForm(),
}));

describe('NewIssueExperienceButton', function () {
  const organization = OrganizationFixture({features: ['issue-details-streamline']});
  const user = UserFixture();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  const location = LocationFixture({query: {streamline: '1'}});

  beforeEach(() => {
    ConfigStore.init();
    jest.clearAllMocks();
  });

  it('does not appear by default', function () {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
  });

  it('does not appear when an organization has the single interface option', function () {
    const {unmount: unmountOptionTrue} = render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {
        organization: {
          ...organization,
          streamlineOnly: true,
        },
      }
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
    unmountOptionTrue();

    const {unmount: unmountOptionFalse} = render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {
        organization: {
          ...organization,
          streamlineOnly: false,
        },
      }
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
    unmountOptionFalse();
  });

  it('does not appear when an organization has the enforce flag', function () {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {
        organization: {
          ...organization,
          features: [...organization.features, 'issue-details-streamline-enforce'],
        },
      }
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
  });

  it('appears when organization has flag', function () {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {organization}
    );
    expect(screen.getByTestId('test-id')).not.toBeEmptyDOMElement();
  });

  it('does not appear even if user prefers this UI', function () {
    act(() => ConfigStore.set('user', user));
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
  });

  it('does not appear when query param is set', function () {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {router: {location}}
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
  });

  it('triggers changes to the user config and location', async function () {
    const mockChangeUserSettings = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
    });

    render(<NewIssueExperienceButton />, {organization});

    const button = screen.getByRole('button', {
      name: 'Switch to the new issue experience',
    });

    await userEvent.click(button);
    // Text should change immediately
    expect(
      screen.getByRole('button', {name: 'Switch to the old issue experience'})
    ).toBeInTheDocument();
    // User option should be saved
    await waitFor(() => {
      expect(mockChangeUserSettings).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({
          data: {
            options: {
              prefersIssueDetailsStreamlinedUI: true,
            },
          },
        })
      );
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Clicking again toggles it off
    await userEvent.click(button);
    // Old text should be back
    expect(
      screen.getByRole('button', {name: 'Switch to the new issue experience'})
    ).toBeInTheDocument();
    // And save the option as false
    await waitFor(() => {
      expect(mockChangeUserSettings).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({
          data: {
            options: {
              prefersIssueDetailsStreamlinedUI: false,
            },
          },
        })
      );
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
  });

  it('can switch back to the old UI via dropdown', async function () {
    const mockFormCallback = jest.fn();
    mockFeedbackForm.mockReturnValue(mockFormCallback);
    const mockChangeUserSettings = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
    });

    render(<NewIssueExperienceButton />, {organization});
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Switch to the new issue experience',
      })
    );

    expect(
      screen.getByRole('button', {
        name: 'Switch issue experience',
      })
    ).toBeInTheDocument();

    const dropdownButton = screen.getByRole('button', {
      name: 'Switch issue experience',
    });
    await userEvent.click(dropdownButton);

    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Give feedback on new UI'})
    );
    expect(mockFeedbackForm).toHaveBeenCalled();

    await userEvent.click(dropdownButton);
    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: 'Switch to the old issue experience',
      })
    );
    expect(mockChangeUserSettings).toHaveBeenCalledTimes(2);
  });
});
