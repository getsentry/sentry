import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationMcpCli from 'sentry/views/settings/organizationMcpCli';

describe('OrganizationMcpCli', () => {
  it('shows CLI MCP setup scoped to the organization', () => {
    const organization = OrganizationFixture({slug: 'acme'});

    render(<OrganizationMcpCli />, {organization});

    expect(
      screen.getByDisplayValue('claude mcp add sentry -- sentry mcp acme/')
    ).toBeInTheDocument();
    expect(screen.getByText(/"acme\/"/)).toBeInTheDocument();
  });
});
