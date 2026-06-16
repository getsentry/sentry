import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeerAutomationRepos from 'getsentry/views/seerAutomation/repos';

describe('SeerAutomationRepos', () => {
  it('shows no access for legacy seer-added-only orgs', () => {
    const organization = OrganizationFixture({
      features: ['seer-added'],
    });

    render(<SeerAutomationRepos />, {organization});

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });
});
