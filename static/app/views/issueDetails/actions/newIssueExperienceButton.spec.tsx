import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';

const mockUseNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockUseNavigate,
}));
jest.mock('sentry/utils/analytics');

describe('NewIssueExperienceButton', function () {
  const organization = OrganizationFixture({features: ['issue-details-streamline']});
  const user = UserFixture();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  const location = LocationFixture({query: {streamline: '1'}});

  beforeEach(() => {
    ConfigStore.init();
  });

  it('does not appear by default', function () {
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>
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
    // Location should update
    expect(mockUseNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: {streamline: '1'}})
    );
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
    // Location should update again
    expect(mockUseNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: {streamline: '0'}})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
  });
});
