import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectPerformance from 'app/views/settings/projectPerformance/projectPerformance';

describe('projectPerformance', function () {
  const org = TestStubs.Organization({features: ['project-transaction-threshold']});
  const project = TestStubs.ProjectDetails();
  let getMock, postMock, deleteMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        id: project.id,
        threshold: '300',
        metric: 'duration',
      },
      statusCode: 200,
    });
    postMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'POST',
      body: {
        id: project.id,
        threshold: '400',
        metric: 'lcp',
      },
      statusCode: 200,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'DELETE',
      statusCode: 200,
    });
  });

  it('renders the fields', async function () {
    const wrapper = mountWithTheme(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />,
      TestStubs.routerContext()
    );
    await tick();
    expect(wrapper.find('input[name="threshold"]').prop('value')).toBe('300');
    expect(wrapper.find('input[name="metric"]').prop('value')).toBe('duration');
    expect(getMock).toHaveBeenCalled();
  });

  it('updates the field', async function () {
    const wrapper = mountWithTheme(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper
      .find('input[name="threshold"]')
      .simulate('change', {target: {value: '400'}})
      .simulate('blur');

    await tick();

    expect(postMock).toHaveBeenCalled();
    expect(wrapper.find('input[name="threshold"]').prop('value')).toBe('400');
  });

  it('clears the data', async function () {
    const wrapper = mountWithTheme(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />,
      TestStubs.routerContext()
    );
    await tick();

    wrapper.find('Actions').find('Button').simulate('click');

    await tick();
    expect(deleteMock).toHaveBeenCalled();
  });
});
