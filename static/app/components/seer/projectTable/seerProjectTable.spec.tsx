import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {SeerProjectTable} from 'sentry/components/seer/projectTable/seerProjectTable';
import {ProjectsStore} from 'sentry/stores/projectsStore';

// jsdom has no layout, so the virtualizer would render zero rows. Force it to
// render a row per item so the table body is present.
jest.mock('@tanstack/react-virtual', () => ({
  ...jest.requireActual('@tanstack/react-virtual'),
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 41,
        end: (index + 1) * 41,
        size: 41,
        lane: 0,
      })),
    getTotalSize: () => count * 41,
    measure: () => {},
    measureElement: () => {},
  }),
}));

describe('SeerProjectTable', () => {
  const organization = OrganizationFixture({access: ['org:write']});
  const project = ProjectFixture({id: '2', slug: 'project-slug'});

  function mockBaseEndpoints() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [{id: '123', provider: 'cursor', name: 'Cursor Cloud Agent'}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      body: [
        {
          projectId: '2',
          projectSlug: 'project-slug',
          agent: 'seer',
          integrationId: null,
          stoppingPoint: 'root_cause',
          autoCreatePr: null,
          automationTuning: 'off',
          scannerAutomation: false,
          reposCount: 1,
        },
      ],
    });
  }

  function mockProjectRepos(provider: string) {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      body: [
        {
          id: '1',
          repositoryId: '1',
          branchName: '',
          branchOverrides: [],
          instructions: '',
          externalId: '101',
          integrationId: '201',
          name: 'sentry',
          organizationId: '',
          owner: 'getsentry',
          provider,
        },
      ],
    });
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    mockBaseEndpoints();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.restoreAllMocks();
  });

  function renderTable() {
    render(
      <SentryNuqsTestingAdapter>
        <SeerProjectTable />
      </SentryNuqsTestingAdapter>,
      {organization}
    );
  }

  it('blocks coding-agent handoff and warns for a project with a non-GitHub repo', async () => {
    mockProjectRepos('gitlab');
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    renderTable();

    // The agent dropdown renders its current value, "Seer".
    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Non-GitHub repositories only support handing off to Seer.'
      )
    );
    // The change is never committed or persisted.
    expect(settingsPut).not.toHaveBeenCalled();
    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.queryByText('Cursor Cloud Agent')).not.toBeInTheDocument();
  });

  it('allows coding-agent handoff for a GitHub-only project', async () => {
    mockProjectRepos('github');
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    renderTable();

    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    // The check passes, so the selection is committed (left to the existing
    // blur-to-save flow to persist) and no warning is shown.
    expect(await screen.findByText('Cursor Cloud Agent')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
