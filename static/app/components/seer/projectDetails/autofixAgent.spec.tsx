import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixAgent} from 'sentry/components/seer/projectDetails/autofixAgent';
import type {DetailedProject} from 'sentry/types/project';
import {NON_GITHUB_HANDOFF_WARNING} from 'sentry/utils/seer/preferredAgent';

describe('AutofixAgent', () => {
  let project: DetailedProject;
  const organization = OrganizationFixture();

  function seerRepo(overrides: {provider: string} & Partial<{id: string}>) {
    return {
      id: overrides.id ?? '1',
      repositoryId: overrides.id ?? '1',
      branchName: '',
      branchOverrides: [],
      instructions: '',
      externalId: '101',
      integrationId: '201',
      name: 'sentry',
      organizationId: '',
      owner: 'getsentry',
      provider: overrides.provider,
    };
  }

  function mockEndpoints({
    repos,
    agent = 'seer',
    integrationId = null,
    reposAsyncDelay,
  }: {
    repos: Array<ReturnType<typeof seerRepo>>;
    agent?: string;
    integrationId?: string | null;
    reposAsyncDelay?: number;
  }) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [{id: '123', provider: 'cursor', name: 'Cursor Cloud Agent'}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'GET',
      body: {
        projectId: project.id,
        projectSlug: project.slug,
        agent,
        integrationId,
        stoppingPoint: 'root_cause',
        autoCreatePr: null,
        automationTuning: 'off',
        scannerAutomation: false,
        reposCount: repos.length,
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: repos,
      ...(reposAsyncDelay === undefined ? {} : {asyncDelay: reposAsyncDelay}),
    });
    return MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      body: {},
    });
  }

  beforeEach(() => {
    project = DetailedProjectFixture();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('enables the agent dropdown when only GitHub repos are attached', async () => {
    mockEndpoints({repos: [seerRepo({provider: 'github'})]});

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeEnabled());
    expect(screen.queryByText(NON_GITHUB_HANDOFF_WARNING)).not.toBeInTheDocument();
  });

  it('disables the agent dropdown and warns when a GitLab repo is attached', async () => {
    mockEndpoints({
      repos: [
        seerRepo({id: '1', provider: 'github'}),
        seerRepo({id: '3', provider: 'gitlab'}),
      ],
    });

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeDisabled());
    expect(screen.getByText(NON_GITHUB_HANDOFF_WARNING)).toBeInTheDocument();
  });

  it('disables the agent dropdown for any non-GitHub provider', async () => {
    mockEndpoints({repos: [seerRepo({provider: 'bitbucket'})]});

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeDisabled());
    expect(screen.getByText(NON_GITHUB_HANDOFF_WARNING)).toBeInTheDocument();
  });

  // Regression test for the empty/partial repo list: `.every(isGithub)` on an
  // unsettled list is `true`, which would briefly enable the dropdown (and hide
  // the warning) before the repos query resolves. The dropdown must stay
  // disabled until every page has loaded.
  it('keeps the agent dropdown disabled while the repos query is still loading', async () => {
    // Settings resolves immediately (so the form renders) but the repos query
    // never resolves within the test, leaving it unsettled.
    mockEndpoints({repos: [seerRepo({provider: 'github'})], reposAsyncDelay: 100_000});

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    expect(select).toBeDisabled();
  });

  // Regression test for the display-only override: forcing the select's value to
  // 'seer' without writing it back left the stored agent as a coding agent. When
  // a non-GitHub repo is attached we must persist Seer, not just display it.
  it('persists Seer when a non-GitHub repo is attached and the stored agent is a coding agent', async () => {
    const putMock = mockEndpoints({
      repos: [seerRepo({provider: 'gitlab'})],
      agent: 'cursor',
      integrationId: '123',
    });

    render(<AutofixAgent canWrite project={project} />, {organization});

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/settings/`,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({agent: 'seer'}),
        })
      )
    );
  });

  // The inverse of the above: a GitHub-only project must not trigger a coercion
  // PUT for a stored coding agent.
  it('does not persist Seer when only GitHub repos are attached', async () => {
    const putMock = mockEndpoints({
      repos: [seerRepo({provider: 'github'})],
      agent: 'cursor',
      integrationId: '123',
    });

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeEnabled());
    expect(putMock).not.toHaveBeenCalled();
  });

  // A read-only user must never trigger a write, even to coerce the agent.
  it('does not persist Seer when the user cannot write', async () => {
    const putMock = mockEndpoints({
      repos: [seerRepo({provider: 'gitlab'})],
      agent: 'cursor',
      integrationId: '123',
    });

    render(<AutofixAgent canWrite={false} project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeDisabled());
    expect(putMock).not.toHaveBeenCalled();
  });

  // The coercion mutation rolls back its optimistic update on error, which would
  // re-satisfy the condition and loop. The effect must fire exactly once.
  it('does not retry the Seer coercion after a failed save', async () => {
    mockEndpoints({
      repos: [seerRepo({provider: 'gitlab'})],
      agent: 'cursor',
      integrationId: '123',
    });
    // Registered after mockEndpoints' PUT so this failing response wins.
    const failingPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      statusCode: 500,
      body: {},
    });

    render(<AutofixAgent canWrite project={project} />, {organization});

    await waitFor(() => expect(failingPut).toHaveBeenCalledTimes(1));
    // Let the rollback + refetch settle; the effect must not re-fire.
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Handoff to Agent'})).toBeDisabled()
    );
    expect(failingPut).toHaveBeenCalledTimes(1);
  });
});
