import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {
  act,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {useOpenOverviewSeerDrawer} from 'sentry/views/seerWorkflows/overview/overviewSeerDrawer';

const DRAWER_LABEL = 'Seer drawer';
const GROUP_ID = '2';
const PROJECT_SLUG = 'proj';
const OVERVIEW_PATH = '/organizations/org-slug/issues/autofix/overview/';
const ISSUE_PATH = `/organizations/org-slug/issues/${GROUP_ID}/`;
const GROUP_URL = `/organizations/org-slug/issues/${GROUP_ID}/`;
const PROJECT_URL = `/projects/org-slug/${PROJECT_SLUG}/`;

const enabledOrganization = OrganizationFixture({
  features: ['seer-night-shift-ui', 'gen-ai-features'],
  hideAiFeatures: false,
});

function renderDrawerHook(organization = enabledOrganization) {
  return renderHookWithProviders(() => useOpenOverviewSeerDrawer(), {
    organization,
    initialRouterConfig: {location: {pathname: OVERVIEW_PATH}},
  });
}

function openDrawer(result: ReturnType<typeof renderDrawerHook>['result']): void {
  act(() => {
    result.current.openSeerDrawer({
      groupId: GROUP_ID,
      projectSlug: PROJECT_SLUG,
    });
  });
}

function mockFailingPrerequisites() {
  const groupRequest = MockApiClient.addMockResponse({
    url: GROUP_URL,
    body: {detail: 'Unable to load group'},
    statusCode: 500,
  });
  const projectRequest = MockApiClient.addMockResponse({
    url: PROJECT_URL,
    body: {detail: 'Unable to load project'},
    statusCode: 500,
  });
  return {groupRequest, projectRequest};
}

describe('useOpenOverviewSeerDrawer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it.each([
    OrganizationFixture({
      features: ['seer-night-shift-ui'],
      hideAiFeatures: false,
    }),
    OrganizationFixture({
      features: ['seer-night-shift-ui', 'gen-ai-features'],
      hideAiFeatures: true,
    }),
  ])('does not open inline when AI features are unavailable', organization => {
    const {groupRequest, projectRequest} = mockFailingPrerequisites();
    const {result} = renderDrawerHook(organization);

    expect(result.current.canOpenSeerDrawer).toBe(false);
    openDrawer(result);

    expect(
      screen.queryByRole('complementary', {name: DRAWER_LABEL})
    ).not.toBeInTheDocument();
    expect(groupRequest).not.toHaveBeenCalled();
    expect(projectRequest).not.toHaveBeenCalled();
  });

  it.each(['group', 'project'] as const)(
    'shows a retryable error when the %s request fails',
    async failedRequest => {
      const groupRequest = MockApiClient.addMockResponse({
        url: GROUP_URL,
        body:
          failedRequest === 'group'
            ? {detail: 'Unable to load group'}
            : GroupFixture({id: GROUP_ID}),
        statusCode: failedRequest === 'group' ? 500 : 200,
      });
      const projectRequest = MockApiClient.addMockResponse({
        url: PROJECT_URL,
        body:
          failedRequest === 'project'
            ? {detail: 'Unable to load project'}
            : DetailedProjectFixture({slug: PROJECT_SLUG}),
        statusCode: failedRequest === 'project' ? 500 : 200,
      });
      const failedMock = failedRequest === 'group' ? groupRequest : projectRequest;
      const successfulMock = failedRequest === 'group' ? projectRequest : groupRequest;
      const {result} = renderDrawerHook();

      expect(result.current.canOpenSeerDrawer).toBe(true);
      openDrawer(result);

      expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
      expect(failedMock).toHaveBeenCalledTimes(1);
      expect(successfulMock).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

      await waitFor(() => expect(failedMock).toHaveBeenCalledTimes(2));
      expect(successfulMock).toHaveBeenCalledTimes(1);
    }
  );

  it('stays open for query changes and closes when the pathname changes', async () => {
    mockFailingPrerequisites();
    const {result, router} = renderDrawerHook();

    openDrawer(result);

    expect(
      await screen.findByRole('complementary', {name: DRAWER_LABEL})
    ).toBeInTheDocument();

    act(() => {
      router.navigate(`${OVERVIEW_PATH}?sort=events`);
    });
    await waitFor(() => expect(router.location.query.sort).toBe('events'));
    expect(screen.getByRole('complementary', {name: DRAWER_LABEL})).toBeInTheDocument();

    act(() => {
      router.navigate(ISSUE_PATH);
    });
    await waitForDrawerToHide(DRAWER_LABEL);
  });
});
