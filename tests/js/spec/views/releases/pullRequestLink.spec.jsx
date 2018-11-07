import React from 'react';
import {mount} from 'enzyme';

import PullRequestLink from 'app/views/releases/pullRequestLink';

describe('PullRequestLink', function() {
  it('renders no url on missing provider', function() {
    let repository = TestStubs.Repository({provider: null});
    let pullRequest = TestStubs.PullRequest({repository});
    let wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    expect(wrapper.find('a')).toHaveLength(0);
    expect(wrapper.find('span').text()).toEqual('repo-name #3: Fix first issue');
  });

  it('renders github links for integrations:github repositories', function() {
    let repository = TestStubs.Repository({
      provider: {
        id: 'integrations:github',
      },
    });
    let pullRequest = TestStubs.PullRequest({repository});
    let wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    let icon = wrapper.find('InlineSvg');
    expect(icon).toHaveLength(1);
    expect(icon.props().src).toEqual('icon-github');

    let link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('repo-name #3: Fix first issue');
  });

  it('renders github links for github repositories', function() {
    let repository = TestStubs.Repository({
      provider: {
        id: 'github',
      },
    });
    let pullRequest = TestStubs.PullRequest({repository});
    let wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    let icon = wrapper.find('InlineSvg');
    expect(icon).toHaveLength(1);
    expect(icon.props().src).toEqual('icon-github');

    let link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('repo-name #3: Fix first issue');
  });

  it('renders gitlab links for integrations:gitlab repositories', function() {
    let repository = TestStubs.Repository({
      provider: {
        id: 'integrations:gitlab',
      },
    });
    let pullRequest = TestStubs.PullRequest({repository});
    let wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    let icon = wrapper.find('InlineSvg');
    expect(icon).toHaveLength(1);
    expect(icon.props().src).toEqual('icon-gitlab');

    let link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('repo-name #3: Fix first issue');
  });

  it('renders github links for gitlab repositories', function() {
    let repository = TestStubs.Repository({
      provider: {
        id: 'gitlab',
      },
    });
    let pullRequest = TestStubs.PullRequest({repository});
    let wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    let icon = wrapper.find('InlineSvg');
    expect(icon).toHaveLength(1);
    expect(icon.props().src).toEqual('icon-gitlab');

    let link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('repo-name #3: Fix first issue');
  });
});
