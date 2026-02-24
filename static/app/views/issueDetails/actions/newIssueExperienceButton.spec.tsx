import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {mockTour} from 'sentry/components/tours/testUtils';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';

jest.mock('sentry/utils/analytics');

const mockFeedbackForm = jest.fn();
jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => mockFeedbackForm(),
}));

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('NewIssueExperienceButton', () => {
  const organization = OrganizationFixture({streamlineOnly: null});

  beforeEach(() => {
    ConfigStore.init();
    jest.clearAllMocks();
  });

  it('appears correctly when organization has the single interface option', () => {
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
    expect(screen.getByTestId('test-id')).not.toBeEmptyDOMElement();
    unmountOptionFalse();
  });

  it('appears when organization has flag', () => {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {organization}
    );
    expect(screen.getByTestId('test-id')).not.toBeEmptyDOMElement();
  });

  it('triggers changes to the user config and location', async () => {
    const mockChangeUserSettings = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
    });

    // Start with old UI preference so the "Switch to new" button appears
    act(() =>
      ConfigStore.set(
        'user',
        UserFixture({
          options: {
            ...UserFixture().options,
            prefersIssueDetailsStreamlinedUI: false,
          },
        })
      )
    );

    render(<NewIssueExperienceButton />, {organization});

    const newExperienceButton = screen.getByRole('button', {
      name: 'Switch to the new issue experience',
    });

    await userEvent.click(newExperienceButton);

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

    await userEvent.click(screen.getByRole('button', {name: 'Manage issue experience'}));
    const oldExperienceButton = screen.getByRole('menuitemradio', {
      name: 'Switch to the old issue experience',
    });
    // Clicking again toggles it off
    await userEvent.click(oldExperienceButton);
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

  it('can switch back to the old UI via dropdown', async () => {
    const mockFormCallback = jest.fn();
    mockFeedbackForm.mockReturnValue(mockFormCallback);
    const mockChangeUserSettings = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
    });

    // Start with old UI preference so the "Switch to new" button appears
    act(() =>
      ConfigStore.set(
        'user',
        UserFixture({
          options: {
            ...UserFixture().options,
            prefersIssueDetailsStreamlinedUI: false,
          },
        })
      )
    );

    render(<NewIssueExperienceButton />, {organization});
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Switch to the new issue experience',
      })
    );

    expect(
      screen.getByRole('button', {
        name: 'Manage issue experience',
      })
    ).toBeInTheDocument();

    const dropdownButton = screen.getByRole('button', {
      name: 'Manage issue experience',
    });
    await userEvent.click(dropdownButton);

    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Give feedback on the UI'})
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
