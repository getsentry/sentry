import {DocIntegrationFixture} from 'sentry-fixture/docIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import DocIntegrationDetailedView from 'sentry/views/settings/organizationIntegrations/docIntegrationDetailedView';

describe('DocIntegrationDetailedView', () => {
  const organization = OrganizationFixture();
  const doc = DocIntegrationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: `/doc-integrations/${doc.slug}/`,
      body: doc,
    });
    render(<DocIntegrationDetailedView />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/document-integrations/${doc.slug}`,
        },
        route: '/settings/:orgId/document-integrations/:integrationSlug',
      },
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText(doc.name)).toBeInTheDocument();

    expect(getMock).toHaveBeenCalledTimes(1);

    const docLink = screen.getByRole('link', {name: 'Learn More'});
    expect(docLink).toBeInTheDocument();
    expect(docLink).toHaveAttribute('href', doc.url);

    expect(screen.getByText(doc.author)).toBeInTheDocument();
    expect(screen.getByText(doc.description)).toBeInTheDocument();

    for (const resource of doc.resources || []) {
      const link = screen.getByText(resource.title);
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', resource.url);
    }

    for (const feature of doc.features || []) {
      expect(screen.getByText(feature.description)).toBeInTheDocument();
    }
  });
});
