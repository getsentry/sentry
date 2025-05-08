import {installation_info} from 'sentry-fixture/githubInstallationSelect';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GithubInstallationSelect} from './githubInstallationSelect';

describe('GithubInstallationSelect', () => {
  beforeEach(() => {
    window.location.assign = jest.fn();
  });

  it('renders installation options', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    expect(
      screen.getByText('Install on an Existing Github Organization')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Skip'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Skip'})).toBeEnabled();

    expect(screen.getByRole('button', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Install'})).toBeDisabled();

    // Initial selection is None as no installation has been selected
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose Installation',
      })
    );

    expect(screen.getByText('sentaur')).toBeInTheDocument();
    expect(screen.getByText('bufo-bot')).toBeInTheDocument();
    expect(
      screen.getByText('Install integration on a new GitHub organization')
    ).toBeInTheDocument();
  });

  it('enables Install button after selecting an installation', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Install button should be disabled initially
    expect(screen.getByRole('button', {name: 'Install'})).toBeDisabled();

    // Click the select dropdown
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose Installation',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Install button should be enabled
    expect(screen.getByRole('button', {name: 'Install'})).toBeEnabled();
  });

  it('redirects to setup page when clicking next', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Install button should be disabled initially
    expect(screen.getByRole('button', {name: 'Install'})).toBeDisabled();

    // Click the select dropdown
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose Installation',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Install button should be enabled
    expect(screen.getByRole('button', {name: 'Install'})).toBeEnabled();

    // Click next
    await userEvent.click(screen.getByRole('button', {name: 'Install'}));

    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining(
        `/extensions/github/setup/?chosen_installation_id=${installation_info[1]!.installation_id}`
      )
    );
  });

  it('redirects to setup page when selecting skip option', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Initial selection is None as no installation has been selected
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Choose Installation',
      })
    );

    // Select the new installation option
    await userEvent.click(
      screen.getByText('Install integration on a new GitHub organization')
    );

    // Click next
    await userEvent.click(screen.getByRole('button', {name: 'Install'}));

    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining('/extensions/github/setup/?chosen_installation_id=-1')
    );
  });
});
