import React from 'react';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import {IssueDiff} from 'app/components/issueDiff';
import {Client} from 'app/api';

jest.mock('app/api');

describe('IssueDiff', function() {
  const entries = TestStubs.Entries();
  const routerContext = TestStubs.routerContext();
  const api = new MockApiClient();

  it('is loading when initially rendering', function() {
    const wrapper = shallow(
      <IssueDiff
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        projectId="project-slug"
      />
    );
    expect(wrapper.find('SplitDiff')).toHaveLength(0);
    expect(wrapper).toMatchSnapshot();
  });

  it('can dynamically import SplitDiff', async function() {
    Client.addMockResponse({
      url: '/issues/target/events/latest/',
      body: {
        entries: entries[0],
      },
    });
    Client.addMockResponse({
      url: '/issues/base/events/latest/',
      body: {
        platform: 'javascript',
        entries: entries[1],
      },
    });

    // Need `mount` because of componentDidMount in <IssueDiff>
    const wrapper = mountWithTheme(
      <IssueDiff
        api={api}
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        projectId="project-slug"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('SplitDiff')).toHaveLength(1);
    expect(wrapper).toMatchSnapshot();
  });

  it('can diff message', async function() {
    Client.addMockResponse({
      url: '/issues/target/events/latest/',
      body: {
        entries: [{type: 'message', data: {formatted: 'Hello World'}}],
      },
    });
    Client.addMockResponse({
      url: '/issues/base/events/latest/',
      body: {
        platform: 'javascript',
        entries: [{type: 'message', data: {formatted: 'Foo World'}}],
      },
    });

    // Need `mount` because of componentDidMount in <IssueDiff>
    const wrapper = mountWithTheme(
      <IssueDiff
        api={api}
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        projectId="project-slug"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('SplitDiff')).toHaveLength(1);
    expect(wrapper).toMatchSnapshot();
  });
});
