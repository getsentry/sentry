import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import App from 'sentry/views/app';

describe('Docs Search Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TestStubs.Team({slug: 'foo-team'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: TestStubs.Members(),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  it('can open help search modal', async function () {
    const {routerContext} = initializeOrg();

    render(<App>{<div>placeholder content</div>}</App>, {context: routerContext});

    // No Modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open Modal
    openHelpSearchModal();

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Search for documentation, FAQs, blog posts...'
    );
  });
});
