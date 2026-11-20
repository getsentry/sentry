import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AutomationConfiguration from './configuration';

describe('AutomationConfiguration', () => {
  it('shows not found without an automation', () => {
    render(<AutomationConfiguration />, {
      organization: OrganizationFixture({features: ['seer-automations']}),
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
