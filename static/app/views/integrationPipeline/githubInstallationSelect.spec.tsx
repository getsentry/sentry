import {installation_info} from 'sentry-fixture/githubInstallationSelect';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GithubInstallationSelect} from './githubInstallationSelect';

describe('GithubInstallationSelect', () => {
  beforeEach(() => {
    window.location.assign = jest.fn();
  });

  it('renders installation options', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    expect(screen.getByText('Select a Github Installation')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Skip'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    // Initial selection is None as no installation has been selected
    await userEvent.click(
      screen.getByRole('button', {
        name: 'None',
      })
    );

    expect(screen.getByText('sentaur')).toBeInTheDocument();
    expect(screen.getByText('bufo-bot')).toBeInTheDocument();
  });

  it('enables next button after selecting an installation', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Next button should be disabled initially
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    // Select an installation
    await userEvent.click(
      screen.getByRole('button', {
        name: 'None',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Next button should be enabled
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
  });

  it('redirects to setup page when clicking next', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Next button should be disabled initially
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    // Select an installation
    await userEvent.click(
      screen.getByRole('button', {
        name: 'None',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Next button should be enabled
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();

    // Click next
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining(
        `/extensions/github/setup/?chosen_installation_id=${installation_info[1]?.id}`
      )
    );
  });

  it('redirects to setup page when clicking skip', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Click skip
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}));

    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining('/extensions/github/setup/?chosen_installation_id=-1')
    );
  });

  it('shows tooltip on skip button', async () => {
    render(<GithubInstallationSelect installation_info={installation_info} />);

    // Hover over skip button
    await userEvent.hover(screen.getByRole('button', {name: 'Skip'}));

    // Tooltip should be visible
    expect(
      await screen.findByText(
        'Skip to install the Sentry integration on a new Github organization'
      )
    ).toBeInTheDocument();
  });
});
