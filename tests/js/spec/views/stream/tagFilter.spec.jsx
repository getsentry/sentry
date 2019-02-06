import React from 'react';

import {mount} from 'enzyme';
import StreamTagFilter from 'app/views/stream/tagFilter';

describe('Stream TagFilter', function() {
  let projectApiMock;
  let orgApiMock;

  let organization;
  let project;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    organization = TestStubs.Organization();
    project = TestStubs.ProjectDetails();
    projectApiMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/tags/browser/values/`,
      body: [
        {
          count: 0,
          firstSeen: '2018-05-30T11:33:46.535Z',
          key: 'browser',
          lastSeen: '2018-05-30T11:33:46.535Z',
          name: 'foo',
          value: 'foo',
        },
      ],
    });

    orgApiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/browser/values/`,
      body: [
        {
          count: 0,
          firstSeen: '2018-05-30T11:33:46.535Z',
          key: 'browser',
          lastSeen: '2018-05-30T11:33:46.535Z',
          name: 'foo',
          value: 'foo',
        },
      ],
    });
  });

  it('calls API and renders options when opened', async function() {
    const selectMock = jest.fn();
    const tag = {key: 'browser', name: 'Browser'};
    const wrapper = mount(
      <StreamTagFilter
        tag={tag}
        orgId={organization.slug}
        projectId={project.slug}
        value=""
        onSelect={selectMock}
      />
    );

    wrapper.find('input').simulate('focus');
    wrapper.find('.Select-control').simulate('mouseDown', {button: 0});

    await tick();
    wrapper.update();

    expect(projectApiMock).toHaveBeenCalled();
    expect(wrapper.find('div.Select-option').prop('children')).toBe('foo');

    wrapper.find('Option').simulate('mouseDown');
    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });

  it('calls API and renders options when opened without project', async function() {
    const selectMock = jest.fn();
    const tag = {key: 'browser', name: 'Browser'};
    const wrapper = mount(
      <StreamTagFilter
        tag={tag}
        orgId={organization.slug}
        value=""
        onSelect={selectMock}
      />
    );

    wrapper.find('input').simulate('focus');
    wrapper.find('.Select-control').simulate('mouseDown', {button: 0});

    await tick();
    wrapper.update();

    expect(orgApiMock).toHaveBeenCalled();
    expect(wrapper.find('div.Select-option').prop('children')).toBe('foo');

    wrapper.find('Option').simulate('mouseDown');
    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });
});
