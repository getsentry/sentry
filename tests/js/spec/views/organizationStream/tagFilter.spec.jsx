import React from 'react';
import {mount} from 'enzyme';

import StreamTagFilter from 'app/views/organizationStream/tagFilter';

describe('Stream TagFilter', function() {
  let tagValueLoader;
  let project;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    project = TestStubs.ProjectDetails();

    tagValueLoader = (key, search) => {
      return new Promise(function(resolve, reject) {
        const data = [
          {
            count: 0,
            firstSeen: '2018-05-30T11:33:46.535Z',
            key: 'browser',
            lastSeen: '2018-05-30T11:33:46.535Z',
            name: 'foo',
            value: 'foo',
          },
        ];
        return resolve(data);
      });
    };
  });

  it('calls API and renders options when opened', async function() {
    const selectMock = jest.fn();
    const tag = {key: 'browser', name: 'Browser'};
    const wrapper = mount(
      <StreamTagFilter
        tag={tag}
        projectId={project.slug}
        value=""
        onSelect={selectMock}
        tagValueLoader={tagValueLoader}
      />
    );

    wrapper.find('input').simulate('focus');
    wrapper.find('.Select-control').simulate('mouseDown', {button: 0});

    await tick();
    wrapper.update();

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
        value=""
        onSelect={selectMock}
        tagValueLoader={tagValueLoader}
      />
    );

    wrapper.find('input').simulate('focus');
    wrapper.find('.Select-control').simulate('mouseDown', {button: 0});

    await tick();
    wrapper.update();

    expect(wrapper.find('div.Select-option').prop('children')).toBe('foo');

    wrapper.find('Option').simulate('mouseDown');
    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });
});
