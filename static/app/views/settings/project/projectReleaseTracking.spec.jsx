import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {fetchPlugins} from 'sentry/actionCreators/plugins';
import ProjectReleaseTrackingContainer, {
  ProjectReleaseTracking,
} from 'sentry/views/settings/project/projectReleaseTracking';

jest.mock('sentry/actionCreators/plugins', () => ({
  fetchPlugins: jest.fn().mockResolvedValue([]),
}));

describe('ProjectReleaseTracking', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const url = `/projects/${org.slug}/${project.slug}/releases/token/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: TestStubs.Plugins(),
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });
  });

  it('renders with token', function () {
    render(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: TestStubs.Plugins()}}
        params={{orgId: org.slug, projectId: project.slug}}
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue('token token token');
  });

  it('can regenerate token', function () {
    render(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: TestStubs.Plugins()}}
        params={{orgId: org.slug, projectId: project.slug}}
      />
    );

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });

    // Click Regenerate Token
    userEvent.click(screen.getByRole('button', {name: 'Regenerate Token'}));

    renderGlobalModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        data: {
          project: project.slug,
        },
      })
    );
  });

  it('fetches new plugins when project changes', function () {
    const {rerender} = render(
      <ProjectReleaseTrackingContainer
        organization={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug}}
      />
    );
    expect(fetchPlugins).toHaveBeenCalled();

    fetchPlugins.mockClear();

    // For example, this happens when we switch to a new project using settings breadcrumb
    rerender(
      <ProjectReleaseTrackingContainer
        organization={org}
        project={{...project, slug: 'new-project'}}
        params={{orgId: org.slug, projectId: 'new-project'}}
      />
    );

    expect(fetchPlugins).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'new-project',
      })
    );

    fetchPlugins.mockClear();

    // Does not call fetchPlugins if slug is the same
    rerender(
      <ProjectReleaseTrackingContainer
        organization={org}
        project={{...project, slug: 'new-project'}}
        params={{orgId: org.slug, projectId: 'new-project'}}
      />
    );
    expect(fetchPlugins).not.toHaveBeenCalled();
  });
});
