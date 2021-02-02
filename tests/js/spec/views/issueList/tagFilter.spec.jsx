import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {openMenu, selectByLabel} from 'sentry-test/select-new';

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

    openMenu(wrapper, {control: true});

    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'foo', {control: true});
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

    openMenu(wrapper, {control: true});
    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'foo', {control: true});

    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });
});
