import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

const INTEGRATIONS_LINK =
  '/settings/org-slug/integrations/?category=source%20code%20management';

describe('ConnectScmBlock', () => {
  const organization = OrganizationFixture({
    slug: 'org-slug',
    features: ['seer-cursor-origin-support'],
  });
  const github = GitHubIntegrationFixture({
    name: 'acme',
    domainName: 'github.com/acme',
    organizationIntegrationStatus: 'active',
  });

  function renderBlock({
    integrations,
    failureReason,
    query = {},
    repoName = 'acme/app',
  }: {
    failureReason: string;
    integrations: Array<typeof github>;
    query?: Record<string, string>;
    repoName?: string;
  }) {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: integrations,
    });
    const respondToUserInput = jest.fn();
    const pendingInput: PendingUserInput = {
      id: 'input-id',
      input_type: 'connect_scm',
      data: {repo_name: repoName, failure_reason: failureReason},
    };
    render(
      <ConnectScmBlock
        pendingInput={pendingInput}
        respondToUserInput={respondToUserInput}
      />,
      {
        organization,
        initialRouterConfig: {location: {pathname: '/mock-pathname/', query}},
      }
    );
    return respondToUserInput;
  }

  it('links to integrations when nothing is connected', async () => {
    renderBlock({integrations: [], failureReason: 'no_scm_integration'});

    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.getByText('No source control is connected to this organization.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect source control'})).toHaveAttribute(
      'href',
      INTEGRATIONS_LINK
    );
  });

  it('links to integrations when the repo is under another account', async () => {
    renderBlock({
      integrations: [{...github, name: 'other', domainName: 'github.com/other'}],
      failureReason: 'scm_account_not_connected',
    });

    expect(
      await screen.findByText(
        "This repo's account isn't connected to this organization. Connected: other."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to integrations'})).toHaveAttribute(
      'href',
      INTEGRATIONS_LINK
    );
  });

  it('links to the provider when the repo is not in Sentry', async () => {
    renderBlock({integrations: [github], failureReason: 'repo_not_in_sentry'});

    expect(
      await screen.findByText(
        "This repo isn't in Sentry. Check its name, and that Sentry can access it on GitHub."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to GitHub'})).toHaveAttribute(
      'href',
      'https://github.com'
    );
  });

  it.each([
    [
      'GitHub Enterprise',
      'github_enterprise',
      'acme',
      'ghe.example.com/acme',
      'acme/app',
    ],
    ['GitLab', 'gitlab', 'My Group / Sub', 'gitlab.com/my-group/sub', 'my-group/sub/app'],
    [
      'Cursor Origin',
      'cursor_origin',
      'acme',
      'https://cursor.com/codebase/acme',
      'acme/app',
    ],
  ])(
    'finds the %s account and links to its host',
    async (name, key, accountName, domainName, repoName) => {
      renderBlock({
        integrations: [
          {
            ...github,
            name: accountName,
            domainName,
            provider: {...github.provider, key, name},
          },
        ],
        failureReason: 'repo_not_in_sentry',
        repoName,
      });

      expect(await screen.findByRole('button', {name: `Go to ${name}`})).toHaveAttribute(
        'href',
        `https://${domainName.replace('https://', '').split('/')[0]}`
      );
    }
  );

  it('asks to try again once the account is connected', async () => {
    renderBlock({integrations: [github], failureReason: 'no_scm_integration'});

    expect(
      await screen.findByText('Perfect, source control is connected')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Go to GitHub'})).not.toBeInTheDocument();
  });

  it('retries on Continue once the account is connected', async () => {
    const respondToUserInput = renderBlock({
      integrations: [github],
      failureReason: 'no_scm_integration',
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Continue'}));

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'retry'});
  });

  it('answers when continuing without the code', async () => {
    const respondToUserInput = renderBlock({
      integrations: [],
      failureReason: 'no_scm_integration',
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Continue without code'})
    );

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'skip'});
  });

  it('keeps the name field open from the URL and sends the corrected name', async () => {
    const respondToUserInput = renderBlock({
      integrations: [github],
      failureReason: 'repo_not_in_sentry',
      query: {seerCorrectRepo: 'input-id'},
    });

    const field = await screen.findByRole('textbox', {name: 'Repository name'});
    expect(field).toHaveValue('acme/app');
    await userEvent.clear(field);
    await userEvent.type(field, 'acme/real');
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {
      decision: 'correct_repo',
      repo_name: 'acme/real',
    });
  });

  it('starts closed for a later request', async () => {
    renderBlock({
      integrations: [github],
      failureReason: 'repo_not_in_sentry',
      query: {seerCorrectRepo: 'earlier-input-id'},
    });

    expect(
      await screen.findByRole('button', {name: 'Correct repo name'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Repository name'})
    ).not.toBeInTheDocument();
  });
});
