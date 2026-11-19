import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StatsHeader} from './header';

describe('StatsHeader', () => {
  it('shows the Seer tab in token-billed Seer orgs', () => {
    const organization = OrganizationFixture({
      features: ['token-billed-seer-enabled'],
      access: ['org:read'],
    });

    render(<StatsHeader organization={organization} activeTab="seer" />, {
      organization,
    });

    expect(screen.getByRole('tab', {name: 'Usage'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Seer'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', {name: 'Issues'})).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Health'})).not.toBeInTheDocument();
  });

  it('puts the Seer tab after the team insights tabs', () => {
    const organization = OrganizationFixture({
      features: ['token-billed-seer-enabled', 'team-insights'],
    });

    render(<StatsHeader organization={organization} activeTab="stats" />, {
      organization,
    });

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Usage',
      'Issues',
      'Health',
      'Seer',
    ]);
  });

  it('hides the Seer tab in orgs without token-billed Seer', () => {
    const organization = OrganizationFixture({features: ['team-insights']});

    render(<StatsHeader organization={organization} activeTab="stats" />, {
      organization,
    });

    expect(screen.getByRole('tab', {name: 'Issues'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Seer'})).not.toBeInTheDocument();
  });

  it('shows no tabs when the org has only the Usage tab', () => {
    const organization = OrganizationFixture();

    render(<StatsHeader organization={organization} activeTab="stats" />, {
      organization,
    });

    expect(screen.getByRole('heading', {name: 'Stats & Usage'})).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
