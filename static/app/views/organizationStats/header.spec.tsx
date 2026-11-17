import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StatsHeader} from './header';

describe('StatsHeader', () => {
  it('shows the Seer tab to billing members of token-billed Seer orgs', () => {
    const organization = OrganizationFixture({
      features: ['token-billed-seer-enabled'],
      access: ['org:read', 'org:billing'],
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

  it('hides the Seer tab from members without billing access', () => {
    const organization = OrganizationFixture({
      features: ['token-billed-seer-enabled', 'team-insights'],
      access: ['org:read'],
    });

    render(<StatsHeader organization={organization} activeTab="stats" />, {
      organization,
    });

    expect(screen.getByRole('tab', {name: 'Issues'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Seer'})).not.toBeInTheDocument();
  });

  it('shows no tabs when the org has only the Usage tab', () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});

    render(<StatsHeader organization={organization} activeTab="stats" />, {
      organization,
    });

    expect(screen.getByRole('heading', {name: 'Stats & Usage'})).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
