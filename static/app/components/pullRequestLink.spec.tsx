import {PullRequest} from 'sentry-fixture/pullRequest';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PullRequestLink from 'sentry/components/pullRequestLink';

describe('PullRequestLink', () => {
  it('renders no url on missing externalUrl', () => {
    const repository = TestStubs.Repository({provider: null});
    const pullRequest = PullRequest({
      repository,
      externalUrl: undefined,
    });
    render(<PullRequestLink repository={repository} pullRequest={pullRequest} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('example/repo-name #3: Fix first issue')).toBeInTheDocument();
  });

  it('renders github links for integrations:github repositories', () => {
    const repository = TestStubs.Repository({
      provider: {
        id: 'integrations:github',
      },
    });
    const pullRequest = PullRequest({repository});
    render(<PullRequestLink repository={repository} pullRequest={pullRequest} />);

    expect(screen.getByTestId('pull-request-github')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'example/repo-name #3: Fix first issue'})
    ).toBeInTheDocument();
  });

  it('renders github links for github repositories', () => {
    const repository = TestStubs.Repository({
      provider: {
        id: 'github',
      },
    });
    const pullRequest = PullRequest({repository});
    render(<PullRequestLink repository={repository} pullRequest={pullRequest} />);

    expect(screen.getByTestId('pull-request-github')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'example/repo-name #3: Fix first issue'})
    ).toBeInTheDocument();
  });

  it('renders gitlab links for integrations:gitlab repositories', () => {
    const repository = TestStubs.Repository({
      provider: {
        id: 'integrations:gitlab',
      },
    });
    const pullRequest = PullRequest({repository});
    render(<PullRequestLink repository={repository} pullRequest={pullRequest} />);

    expect(screen.getByTestId('pull-request-gitlab')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'example/repo-name #3: Fix first issue'})
    ).toBeInTheDocument();
  });

  it('renders github links for gitlab repositories', () => {
    const repository = TestStubs.Repository({
      provider: {
        id: 'gitlab',
      },
    });
    const pullRequest = PullRequest({repository});
    render(<PullRequestLink repository={repository} pullRequest={pullRequest} />);

    expect(screen.getByTestId('pull-request-gitlab')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'example/repo-name #3: Fix first issue'})
    ).toBeInTheDocument();
  });
});
