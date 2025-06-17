import {installation_info} from 'sentry-fixture/githubInstallationSelect';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableLocation';

import {GithubInstallationSelect} from './githubInstallationSelect';

describe('GithubInstallationSelect', () => {
  it('renders installation options', async () => {
    render(
      <GithubInstallationSelect
        installation_info={installation_info}
        organization={OrganizationFixture({features: ['integrations-scm-multi-org']})}
      />
    );

    expect(
      screen.getByText('Install on an Existing GitHub Organization')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Install'})).toBeEnabled();

    // Initial selection is None as no installation has been selected
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Integrate with a new GitHub organization',
      })
    );

    expect(screen.getByText('sentaur')).toBeInTheDocument();
    expect(screen.getByText('bufo-bot')).toBeInTheDocument();
    expect(screen.getAllByText('Integrate with a new GitHub organization')).toHaveLength(
      2
    );
  });

  it('redirects to setup page when clicking Install', async () => {
    render(
      <GithubInstallationSelect
        installation_info={installation_info}
        organization={OrganizationFixture({features: ['integrations-scm-multi-org']})}
      />
    );
    // Click the select dropdown
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Integrate with a new GitHub organization',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Install button should be enabled
    expect(screen.getByRole('button', {name: 'Install'})).toBeEnabled();

    // Click Install
    await userEvent.click(screen.getByRole('button', {name: 'Install'}));

    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      expect.stringContaining(
        `/extensions/github/setup/?chosen_installation_id=${installation_info[1]!.installation_id}`
      )
    );
  });

  it('redirects to setup page when selecting "skip"(integrate with a new GH org) option', async () => {
    render(
      <GithubInstallationSelect
        installation_info={installation_info}
        organization={OrganizationFixture()}
      />
    );

    // Initial selection is None as no installation has been selected
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Integrate with a new GitHub organization',
      })
    );

    // Click Install
    await userEvent.click(screen.getByRole('button', {name: 'Install'}));

    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      expect.stringContaining('/extensions/github/setup/?chosen_installation_id=-1')
    );
  });

  it('renders the upsell if user is not on biz plan', async () => {
    render(
      <GithubInstallationSelect
        installation_info={installation_info}
        organization={OrganizationFixture()}
      />
    );

    expect(
      screen.getByText('Install on an Existing GitHub Organization')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Install'})).toBeEnabled();

    // Click the select dropdown
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Integrate with a new GitHub organization',
      })
    );

    // Select an installation
    await userEvent.click(screen.getByText('bufo-bot'));

    // Button should show message to upgrade
    expect(
      screen.getByRole('button', {
        name: 'Upgrade',
      })
    ).toBeInTheDocument();
  });
});
