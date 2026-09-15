import {createBrowserHistory} from '@remix-run/router';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import GroupDetails from 'sentry/views/issueDetails/groupDetails';

// Exercise the page's drawer lifecycle without mounting unrelated issue content.
jest.mock('sentry/views/issueDetails/groupDetailsLayout', () => ({
  GroupDetailsLayout: () => null,
}));

describe('Issue details Seer drawer', () => {
  const group = GroupFixture();
  const event = EventFixture();
  const {organization, projects, project} = initializeOrg({
    organization: {hideAiFeatures: false, features: ['gen-ai-features']},
  });
  const pathname = `/organizations/${organization.slug}/issues/${group.id}/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData(projects));
    MockApiClient.addMockResponse({url: '/assistant/', body: []});
    MockApiClient.addMockResponse({url: pathname, body: group});
    MockApiClient.addMockResponse({url: `${pathname}tags/`, body: []});
    MockApiClient.addMockResponse({url: `${pathname}events/recommended/`, body: event});
    MockApiClient.addMockResponse({
      url: `${pathname}autofix/setup/`,
      body: AutofixSetupFixture({}),
    });
    MockApiClient.addMockResponse({url: `${pathname}autofix/`, body: {autofix: null}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      body: {code_mapping_repos: [], preference: null},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {isSeerConfigured: false},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/autofix-repos/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      body: [],
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    GroupStore.reset();
    PageFiltersStore.reset();
  });

  it.each(['button', 'Escape'])('stays closed after closing with %s', async close => {
    const query = {
      project: group.project.id,
      statsPeriod: '14d',
      seerDrawer: 'true',
      seerDrawerAction: 'retry_code_changes',
    };
    setWindowLocation(`http://localhost${pathname}?${new URLSearchParams(query)}`);
    const {router} = render(<GroupDetails />, {
      organization,
      // Match Main's browser router and nuqs adapter, including navigation timing.
      history: createBrowserHistory(),
      routerFuture: {v7_startTransition: false},
      additionalWrapper: NuqsAdapter,
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/',
        location: {pathname, query},
      },
    });

    const closeButton = await screen.findByRole('button', {name: 'Close Drawer'});
    if (close === 'button') {
      await userEvent.click(closeButton);
    } else {
      await userEvent.keyboard('{Escape}');
    }
    await waitFor(() => {
      expect(
        screen.queryByRole('complementary', {name: 'Seer drawer'})
      ).not.toBeInTheDocument();
    });
    expect(router.location.query).toEqual({
      project: group.project.id,
      statsPeriod: '14d',
    });

    router.navigate(`${pathname}?project=${group.project.id}&seerDrawer=true`);
    expect(await screen.findByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();
  });
});
