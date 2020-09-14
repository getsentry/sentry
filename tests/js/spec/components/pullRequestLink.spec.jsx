import React from 'react';

import {mount} from 'sentry-test/enzyme';

import PullRequestLink from 'app/components/pullRequestLink';

describe('PullRequestLink', function() {
  it('renders no url on missing externalUrl', function() {
    const repository = TestStubs.Repository({provider: null});
    const pullRequest = TestStubs.PullRequest({
      repository,
      externalUrl: null,
    });
    const wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    expect(wrapper.find('a')).toHaveLength(0);
    expect(wrapper.find('span').text()).toEqual('example/repo-name #3: Fix first issue');
  });

  it('renders github links for integrations:github repositories', function() {
    const repository = TestStubs.Repository({
      provider: {
        id: 'integrations:github',
      },
    });
    const pullRequest = TestStubs.PullRequest({repository});
    const wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    const icon = wrapper.find('IconGithub').hostNodes();
    expect(icon).toHaveLength(0);

    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('example/repo-name #3: Fix first issue');
  });

  it('renders github links for github repositories', function() {
    const repository = TestStubs.Repository({
      provider: {
        id: 'github',
      },
    });
    const pullRequest = TestStubs.PullRequest({repository});
    const wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    const icon = wrapper.find('IconGithub').hostNodes();
    expect(icon).toHaveLength(0);

    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('example/repo-name #3: Fix first issue');
  });

  it('renders gitlab links for integrations:gitlab repositories', function() {
    const repository = TestStubs.Repository({
      provider: {
        id: 'integrations:gitlab',
      },
    });
    const pullRequest = TestStubs.PullRequest({repository});
    const wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    const icon = wrapper.find('IconGitlab').hostNodes();
    expect(icon).toHaveLength(0);

    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('example/repo-name #3: Fix first issue');
  });

  it('renders github links for gitlab repositories', function() {
    const repository = TestStubs.Repository({
      provider: {
        id: 'gitlab',
      },
    });
    const pullRequest = TestStubs.PullRequest({repository});
    const wrapper = mount(
      <PullRequestLink repository={repository} pullRequest={pullRequest} />
    );

    const icon = wrapper.find('IconGitlab').hostNodes();
    expect(icon).toHaveLength(0);

    const link = wrapper.find('a');
    expect(link).toHaveLength(1);
    expect(link.text().trim()).toEqual('example/repo-name #3: Fix first issue');
  });
});
