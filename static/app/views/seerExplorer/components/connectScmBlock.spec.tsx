import {Fragment, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

const REPO_ACCESS_URL = '/organizations/org-slug/seer/repo-access/';
const INTEGRATIONS_LINK =
  '/settings/org-slug/integrations/?category=source%20code%20management';
const REPOS_LINK = '/settings/org-slug/repos/';

describe('ConnectScmBlock', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  function mockRepoAccess(status: string, connectedAccounts: string[] = []) {
    return MockApiClient.addMockResponse({
      url: REPO_ACCESS_URL,
      body: {status, connectedAccounts},
      match: [MockApiClient.matchQuery({repoName: 'acme/app'})],
    });
  }

  function renderBlock({
    failureReason = 'no_scm_integration',
    query = {},
  }: {
    failureReason?: string;
    query?: Record<string, string>;
  } = {}) {
    const respondToUserInput = jest.fn();
    const pendingInput: PendingUserInput = {
      id: 'input-id',
      input_type: 'connect_scm',
      data: {repo_name: 'acme/app', failure_reason: failureReason},
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
    mockRepoAccess('no_scm_integration');
    renderBlock();

    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.getByText('No source control is connected to this organization.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect source control'})).toHaveAttribute(
      'href',
      INTEGRATIONS_LINK
    );
  });

  it('lists the connected accounts when the repo is under another one', async () => {
    mockRepoAccess('scm_account_not_connected', ['acme-labs', 'my-group']);
    renderBlock({failureReason: 'scm_account_not_connected'});

    expect(
      await screen.findByText(
        "This repo's account isn't connected to this organization. Connected: acme-labs, my-group."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to integrations'})).toHaveAttribute(
      'href',
      INTEGRATIONS_LINK
    );
  });

  it('links to repositories when the repo is not in Sentry', async () => {
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({failureReason: 'repo_not_in_sentry'});

    expect(
      await screen.findByText(
        "This repo isn't in Sentry. Check its name, and that Sentry has access to it."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go to repositories'})).toHaveAttribute(
      'href',
      REPOS_LINK
    );
  });

  it('retries on Continue once Seer can access the repo', async () => {
    mockRepoAccess('found');
    const respondToUserInput = renderBlock();

    expect(
      await screen.findByText('Perfect, Seer can access acme/app')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect source control'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'retry'});
  });

  it('offers Continue when Sentry can not tell what is wrong', async () => {
    mockRepoAccess('unknown');
    renderBlock();

    expect(
      await screen.findByText(
        "Sentry can't tell what's wrong. Check the repo name, or continue and Seer will try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it("shows the run's error when the check fails", async () => {
    const check = MockApiClient.addMockResponse({url: REPO_ACCESS_URL, statusCode: 500});
    renderBlock({failureReason: 'repo_not_in_sentry'});

    await act(() => Promise.resolve());
    expect(check).toHaveBeenCalled();
    expect(
      screen.getByText(
        "This repo isn't in Sentry. Check its name, and that Sentry has access to it."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Continue without code'})
    ).toBeInTheDocument();
  });

  describe('while the fix is on its way', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        jest.runOnlyPendingTimers();
      } finally {
        jest.useRealTimers();
      }
    });

    it('checks again until Seer can access the repo', async () => {
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      // The repo reaches Sentry.
      MockApiClient.clearMockResponses();
      const check = mockRepoAccess('found');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(
        await screen.findByText('Perfect, Seer can access acme/app')
      ).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(check).toHaveBeenCalledTimes(1);
    });

    it('stops checking after 10 minutes', async () => {
      const check = mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));
      const checks = check.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(60_000));

      expect(check).toHaveBeenCalledTimes(checks);
    });
  });

  describe('after an earlier pause for the same repo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        jest.runOnlyPendingTimers();
      } finally {
        jest.useRealTimers();
      }
    });

    it("waits for this pause's check instead of showing the earlier answer", async () => {
      function Pauses() {
        const [inputId, setInputId] = useState('earlier-input-id');
        return (
          <Fragment>
            <Button onClick={() => setInputId('input-id')}>Pause again</Button>
            <ConnectScmBlock
              key={inputId}
              pendingInput={{
                id: inputId,
                input_type: 'connect_scm',
                data: {repo_name: 'acme/app', failure_reason: 'repo_not_in_sentry'},
              }}
              respondToUserInput={jest.fn()}
            />
          </Fragment>
        );
      }
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      mockRepoAccess('found');
      render(<Pauses />, {organization});
      expect(
        await screen.findByText('Perfect, Seer can access acme/app')
      ).toBeInTheDocument();

      // Continue retried the call, it failed again, and the run paused on the same repo.
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      MockApiClient.clearMockResponses();
      let answer = () => {};
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'scm_account_not_connected', connectedAccounts: ['acme-labs']},
        asyncDelay: new Promise<void>(resolve => {
          answer = resolve;
        }),
      });
      await user.click(screen.getByRole('button', {name: 'Pause again'}));

      expect(screen.getByText("Seer can't access acme/app")).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();

      answer();
      expect(
        await screen.findByText(
          "This repo's account isn't connected to this organization. Connected: acme-labs."
        )
      ).toBeInTheDocument();
    });
  });

  it('answers when continuing without the code', async () => {
    mockRepoAccess('no_scm_integration');
    const respondToUserInput = renderBlock();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Continue without code'})
    );

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'skip'});
  });

  it('keeps the name field open from the URL and sends the corrected name', async () => {
    mockRepoAccess('repo_not_in_sentry');
    const respondToUserInput = renderBlock({
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
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({
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
