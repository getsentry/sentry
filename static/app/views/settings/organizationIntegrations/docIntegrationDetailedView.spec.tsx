import {DocIntegration as DocIntegrationFixture} from 'sentry-fixture/docIntegration';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import DocIntegrationDetailedView from 'sentry/views/settings/organizationIntegrations/docIntegrationDetailedView';

describe('DocIntegrationDetailedView', function () {
  const {routerProps, organization} = initializeOrg();
  const doc = DocIntegrationFixture();

  beforeEach(function () {});

  it('renders', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: `/doc-integrations/${doc.slug}/`,
      body: doc,
    });
    render(
      <DocIntegrationDetailedView
        {...routerProps}
        organization={organization}
        params={{integrationSlug: doc.slug}}
      />
    );
    await tick();

    expect(getMock).toHaveBeenCalledTimes(1);

    const docLink = screen.getByTestId('learn-more');
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
