import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixAgent} from 'sentry/components/seer/projectDetails/autofixAgent';
import type {DetailedProject} from 'sentry/types/project';

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

  function mockEndpoints({repos}: {repos: Array<ReturnType<typeof seerRepo>>}) {
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
        agent: 'seer',
        integrationId: null,
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
    expect(select).toBeEnabled();
    expect(
      screen.queryByText(/Non-GitHub repositories only support handing off to Seer/)
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByText(/Non-GitHub repositories only support handing off to Seer/)
    ).toBeInTheDocument();
  });

  it('disables the agent dropdown for any non-GitHub provider', async () => {
    mockEndpoints({repos: [seerRepo({provider: 'bitbucket'})]});

    render(<AutofixAgent canWrite project={project} />, {organization});

    const select = await screen.findByRole('textbox', {name: 'Handoff to Agent'});
    await waitFor(() => expect(select).toBeDisabled());
    expect(
      screen.getByText(/Non-GitHub repositories only support handing off to Seer/)
    ).toBeInTheDocument();
  });
});
