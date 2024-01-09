import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';

describe('NewIssueExperienceButton', function () {
  it('triggers changes to the user config', async function () {
    const mockChangeUserSettings = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
    });

    render(<NewIssueExperienceButton />);

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
              issueDetailsNewExperienceQ42023: true,
            },
          },
        })
      );
    });

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
              issueDetailsNewExperienceQ42023: false,
            },
          },
        })
      );
    });
  });
});
