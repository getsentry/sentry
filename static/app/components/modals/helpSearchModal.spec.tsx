import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import App from 'sentry/views/app';

describe('Docs Search Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [OrganizationFixture({slug: 'billy-org', name: 'billy org'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture({slug: 'foo-team'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: MembersFixture(),
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
      url: '/assistant/',
      body: [],
    });
  });

  it('can open help search modal', async function () {
    const {routerContext, routerProps} = initializeOrg();

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>,
      {
        context: routerContext,
      }
    );

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
