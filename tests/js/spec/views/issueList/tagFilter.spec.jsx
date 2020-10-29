import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListTagFilter from 'app/views/issueList/tagFilter';

describe('IssueListTagFilter', function () {
  let tagValueLoader;
  let project;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    project = TestStubs.ProjectDetails();

    tagValueLoader = () =>
      new Promise(resolve =>
        resolve([
          {
            count: 0,
            firstSeen: '2018-05-30T11:33:46.535Z',
            key: 'browser',
            lastSeen: '2018-05-30T11:33:46.535Z',
            name: 'foo',
            value: 'foo',
          },
        ])
      );
  });

  it('calls API and renders options when opened', async function () {
    const selectMock = jest.fn();
    const tag = {key: 'browser', name: 'Browser'};
    const wrapper = mountWithTheme(
      <IssueListTagFilter
        tag={tag}
        projectId={project.slug}
        value=""
        onSelect={selectMock}
        tagValueLoader={tagValueLoader}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('input').simulate('focus');
    wrapper.find('.Select-control').simulate('mouseDown', {button: 0});

    await tick();
    wrapper.update();

    expect(wrapper.find('div.Select-option').prop('children')).toBe('foo');

    wrapper.find('Option').simulate('mouseDown');
    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });

  it('calls API and renders options when opened without project', async function () {
    const selectMock = jest.fn();
    const tag = {key: 'browser', name: 'Browser'};
    const wrapper = mountWithTheme(
      <IssueListTagFilter
        tag={tag}
        value=""
        onSelect={selectMock}
        tagValueLoader={tagValueLoader}
      />,
      TestStubs.routerContext()
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
