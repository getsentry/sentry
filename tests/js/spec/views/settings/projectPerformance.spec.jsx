import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectPerformance from 'sentry/views/settings/projectPerformance/projectPerformance';

describe('projectPerformance', function () {
  const org = TestStubs.Organization({features: ['performance-view']});
  const project = TestStubs.ProjectDetails();
  const configUrl = '/projects/org-slug/project-slug/transaction-threshold/configure/';
  let getMock, postMock, deleteMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'GET',
      body: {
        id: project.id,
        threshold: '300',
        metric: 'duration',
      },
      statusCode: 200,
    });
    postMock = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'POST',
      body: {
        id: project.id,
        threshold: '400',
        metric: 'lcp',
      },
      statusCode: 200,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: configUrl,
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
      />
    );
    await tick();
    expect(wrapper.find('input[name="threshold"]').prop('value')).toBe('300');
    expect(wrapper.find('input[name="metric"]').prop('value')).toBe('duration');
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('updates the field', async function () {
    const wrapper = mountWithTheme(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );
    await tick();
    wrapper
      .find('input[name="threshold"]')
      .simulate('change', {target: {value: '400'}})
      .simulate('blur');

    await tick();

    expect(postMock).toHaveBeenCalledWith(
      configUrl,
      expect.objectContaining({
        data: {threshold: '400'},
      })
    );
    expect(wrapper.find('input[name="threshold"]').prop('value')).toBe('400');
  });

  it('clears the data', async function () {
    const wrapper = mountWithTheme(
      <ProjectPerformance
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        project={project}
      />
    );
    await tick();

    wrapper.find('Actions').find('Button').simulate('click');

    await tick();
    expect(deleteMock).toHaveBeenCalled();
  });
});
