import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import GlobalModal from 'sentry/components/globalModal';
import ProjectLatestReleases from 'sentry/views/projectDetail/projectLatestReleases';

describe('ProjectDetail > ProjectLatestReleases', function () {
  let endpointMock, endpointOlderReleasesMock;
  const {organization, project, router} = initializeOrg();

  beforeEach(async function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [
        TestStubs.Release({version: '1.0.0'}),
        TestStubs.Release({version: '1.0.1'}),
      ],
    });
    endpointOlderReleasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [TestStubs.Release({version: '1.0.0'})],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a list', function () {
    const wrapper = mountWithTheme(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(1);
    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 5},
      })
    );
    expect(endpointOlderReleasesMock).toHaveBeenCalledTimes(0);

    expect(wrapper.find('SectionHeading').text()).toBe('Latest Releases');

    expect(wrapper.find('Version').length).toBe(2);
    expect(wrapper.find('DateTime').at(0).text()).toBe('Mar 23, 2020 1:02 AM');
    expect(wrapper.find('Version').at(1).text()).toBe('1.0.1');
  });

  it('shows the empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    await tick();
    wrapper.update();

    expect(endpointOlderReleasesMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('Version').length).toBe(0);
    expect(wrapper.text()).toContain('No releases found');
  });

  it('shows configure releases buttons', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      <Fragment>
        <GlobalModal />
        <ProjectLatestReleases
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
          projectId={project.slug}
          isProjectStabilized
        />
      </Fragment>
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Version').length).toBe(0);

    const docsButton = wrapper.find('Button').at(0);
    const tourButton = wrapper.find('Button').at(1);

    expect(docsButton.text()).toBe('Start Setup');
    expect(docsButton.prop('href')).toBe('https://docs.sentry.io/product/releases/');

    expect(tourButton.text()).toBe('Get Tour');
    expect(wrapper.find('GlobalModal').props().visible).toEqual(false);
    tourButton.simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('GlobalModal').props().visible).toEqual(true);
  });

  it('calls API with the right params', function () {
    mountWithTheme(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(1);
    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 5, statsPeriod: '7d', environment: 'staging'},
      })
    );
  });

  it('does not call API if project is not stabilized yet', function () {
    mountWithTheme(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
        projectId={project.slug}
        isProjectStabilized={false}
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
  });
});
