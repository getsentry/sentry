import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

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
    const wrapper = mountWithTheme(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: TestStubs.Plugins()}}
        params={{orgId: org.slug, projectId: project.slug}}
      />
    );

    expect(wrapper.find('TextCopyInput').prop('children')).toBe('token token token');
  });

  it('can regenerate token', async function () {
    const wrapper = mountWithTheme(
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
    wrapper.find('Field[label="Regenerate Token"] Button').simulate('click');

    const modal = await mountGlobalModal();
    expect(modal.find('Modal')).toHaveLength(1);

    expect(mock).not.toHaveBeenCalled();

    modal.find('Button[priority="danger"]').simulate('click');

    await tick();
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
    const wrapper = mountWithTheme(
      <ProjectReleaseTrackingContainer
        organization={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug}}
      />
    );
    expect(fetchPlugins).toHaveBeenCalled();

    fetchPlugins.mockClear();

    // For example, this happens when we switch to a new project using settings breadcrumb
    wrapper.setProps({...wrapper.props(), project: {...project, slug: 'new-project'}});
    wrapper.update();

    expect(fetchPlugins).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'new-project',
      })
    );

    fetchPlugins.mockClear();

    // Does not call fetchPlugins if slug is the same
    wrapper.setProps({...wrapper.props(), project: {...project, slug: 'new-project'}});
    wrapper.update();
    expect(fetchPlugins).not.toHaveBeenCalled();
  });
});
