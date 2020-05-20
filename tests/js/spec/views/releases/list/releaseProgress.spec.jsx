import React from 'react';
import moment from 'moment';

import {mountWithTheme} from 'sentry-test/enzyme';

import {ReleaseProgress} from 'app/views/releases/list/releaseProgress';

describe('ReleaseProgress', function() {
  let wrapper, organization, project, getPromptsMock, putMock, routerContext;
  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function() {
    organization = TestStubs.Organization();
    project = TestStubs.Project();
    routerContext = TestStubs.routerContext();

    getPromptsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {},
    });
    putMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/promptsactivity/',
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: false},
        {step: 'commit', complete: false},
        {step: 'deploy', complete: false},
      ],
    });
  });

  it('does not render if steps complete', function() {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: true},
        {step: 'commit', complete: true},
        {step: 'deploy', complete: true},
      ],
    });
    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.state('remainingSteps')).toBe(0);
    expect(wrapper.find('PanelItem').exists()).toBe(false);
  });

  it('renders with next step suggestion', function() {
    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );

    expect(
      wrapper
        .find('span')
        .first()
        .text()
    ).toBe('Next step: Link to a repo');
    expect(getPromptsMock).toHaveBeenCalled();
  });

  it('hides when snoozed', function() {
    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(
      wrapper
        .find('span')
        .first()
        .text()
    ).toBe('Next step: Link to a repo');
    expect(wrapper.find('PanelItem')).toHaveLength(1);

    wrapper
      .find('[data-test-id="snoozed"]')
      .first()
      .simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/promptsactivity/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          organization_id: organization.id,
          project_id: project.id,
          feature: 'releases',
          status: 'snoozed',
        },
      })
    );
    expect(wrapper.state('showBar')).toBe(false);
    expect(wrapper.find('PanelItem').exists()).toBe(false);
  });

  it('does not render when snoozed', function() {
    const snoozed_ts = moment()
      .subtract(1, 'day')
      .unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.state('showBar')).toBe(false);
    expect(wrapper.find('PanelItem').exists()).toBe(false);
  });

  it('renders when snoozed more than 7 days ago', function() {
    const snoozed_ts = moment()
      .subtract(9, 'day')
      .unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.state('showBar')).toBe(true);
    expect(wrapper.find('PanelItem').exists()).toBe(true);
  });

  it('hides when dismissed', function() {
    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );

    wrapper
      .find('[data-test-id="dismissed"]')
      .first()
      .simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/promptsactivity/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          organization_id: organization.id,
          project_id: project.id,
          feature: 'releases',
          status: 'dismissed',
        },
      })
    );
    expect(wrapper.state('showBar')).toBe(false);
    expect(wrapper.find('PanelItem').exists()).toBe(false);
  });

  it('does not render when dismissed', function() {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    wrapper = mountWithTheme(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.state('showBar')).toBe(false);
    expect(wrapper.find('PanelItem').exists()).toBe(false);
  });
});
