import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import ProjectTags from 'sentry/views/settings/projectTags';

describe('ProjectTags', function () {
  let org, project;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: TestStubs.Tags(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(wrapper).toSnapshot();
  });

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    const wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });

  it('disables delete button for users without access', function () {
    const context = {
      organization: TestStubs.Organization({access: []}),
    };

    const wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext([context])
    );

    expect(wrapper.find('Button[disabled=false]')).toHaveLength(0);
  });

  it('deletes tag', async function () {
    const wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />
    );

    const tags = wrapper.state('tags').length;

    wrapper.find('button[data-test-id="delete"]').first().simulate('click');

    // Press confirm in modal
    const modal = await mountGlobalModal();
    modal.find('Button[priority="primary"]').simulate('click');

    await tick(); // Wait for the handleDelete function
    wrapper.update();

    expect(wrapper.state('tags')).toHaveLength(tags - 1);
  });
});
