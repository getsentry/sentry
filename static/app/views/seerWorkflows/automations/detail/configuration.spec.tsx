import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AutomationConfiguration from 'sentry/views/seerWorkflows/automations/detail/configuration';

describe('AutomationConfiguration', () => {
  it('renders the configuration with seer-automations', () => {
    render(<AutomationConfiguration />, {
      organization: OrganizationFixture({features: ['seer-automations']}),
    });

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.queryByText('Page Not Found')).not.toBeInTheDocument();
  });

  it('shows not found without seer-automations', () => {
    render(<AutomationConfiguration />, {organization: OrganizationFixture()});

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });
});
