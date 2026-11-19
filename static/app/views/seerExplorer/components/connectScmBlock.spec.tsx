import {Fragment, useState} from 'react';
import {focusManager} from '@tanstack/react-query';
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
  }: {failureReason?: string} = {}) {
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
      {organization}
    );
    return respondToUserInput;
  }

  it('shows that it is checking until the first answer', async () => {
    mockRepoAccess('repo_not_in_sentry');
    renderBlock({failureReason: 'repo_not_in_sentry'});

    expect(
      screen.getByText('Checking whether Seer can access acme/app')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Continue without code'})
    ).not.toBeInTheDocument();

    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.queryByText('Checking whether Seer can access acme/app')
    ).not.toBeInTheDocument();
  });

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

  it('counts a name that matches more than one repo as found', async () => {
    mockRepoAccess('repo_ambiguous');
    const respondToUserInput = renderBlock();

    expect(
      await screen.findByText('Perfect, Seer can access acme/app')
    ).toBeInTheDocument();
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

  describe('while the fix is on its way', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        focusManager.setFocused(undefined);
        // The popup's own timers update its state.
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps checking while the tab is hidden', async () => {
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      // The user is fixing it in another tab, and the repo reaches Sentry.
      act(() => focusManager.setFocused(false));
      MockApiClient.clearMockResponses();
      mockRepoAccess('found');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(
        await screen.findByText('Perfect, Seer can access acme/app')
      ).toBeInTheDocument();
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

    it('keeps checking while checks fail before the first answer', async () => {
      const failed = MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        statusCode: 500,
      });
      renderBlock({failureReason: 'repo_not_in_sentry'});
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      expect(failed).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Continue without code'})
      ).not.toBeInTheDocument();

      // The check works again.
      MockApiClient.clearMockResponses();
      mockRepoAccess('repo_not_in_sentry');
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
    });

    it('keeps the last answer up when a later check fails', async () => {
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      MockApiClient.clearMockResponses();
      const failed = MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        statusCode: 500,
      });
      await act(() => jest.advanceTimersByTimeAsync(6_000));

      expect(failed).toHaveBeenCalled();
      expect(screen.getByText("Seer can't access acme/app")).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Continue without code'})
      ).toBeInTheDocument();
    });

    it('stops checking after 10 minutes', async () => {
      const check = mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));
      const checks = check.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(60_000));

      expect(check).toHaveBeenCalledTimes(checks);
      expect(screen.getByText('Stopped checking every few seconds.')).toBeInTheDocument();
    });

    it('checks again on Check again after it stopped', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

      // The repo reached Sentry after the popup stopped checking.
      MockApiClient.clearMockResponses();
      const check = mockRepoAccess('found');
      await user.click(screen.getByRole('button', {name: 'Check again'}));

      expect(
        await screen.findByText('Perfect, Seer can access acme/app')
      ).toBeInTheDocument();
      expect(check).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText('Stopped checking every few seconds.')
      ).not.toBeInTheDocument();
    });

    it('keeps checking after Check again', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      const check = mockRepoAccess('repo_not_in_sentry');
      renderBlock({failureReason: 'repo_not_in_sentry'});
      expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

      await user.click(screen.getByRole('button', {name: 'Check again'}));
      await act(() => jest.advanceTimersByTimeAsync(0));
      const checks = check.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(5_000));

      expect(check).toHaveBeenCalledTimes(checks + 1);
      expect(screen.queryByRole('button', {name: 'Check again'})).not.toBeInTheDocument();
    });

    describe('when it stops without an answer', () => {
      beforeEach(() => {
        MockApiClient.addMockResponse({url: REPO_ACCESS_URL, statusCode: 500});
      });

      it("says it couldn't check", async () => {
        renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        expect(
          screen.getByText("Couldn't check whether Seer can access acme/app")
        ).toBeInTheDocument();
        expect(
          screen.queryByText('Checking whether Seer can access acme/app')
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Check again'})).toBeInTheDocument();
        expect(
          screen.getByRole('button', {name: 'Correct repo name'})
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', {name: 'Continue without code'})
        ).toBeInTheDocument();
      });

      it('retries on Continue', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        await user.click(screen.getByRole('button', {name: 'Continue'}));

        expect(respondToUserInput).toHaveBeenCalledWith('input-id', {decision: 'retry'});
      });

      it('checks again on Check again', async () => {
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        renderBlock({failureReason: 'repo_not_in_sentry'});
        await act(() => jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000));

        // The check works again.
        MockApiClient.clearMockResponses();
        const check = mockRepoAccess('found');
        await user.click(screen.getByRole('button', {name: 'Check again'}));

        expect(
          await screen.findByText('Perfect, Seer can access acme/app')
        ).toBeInTheDocument();
        expect(check).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('keeps the answer when the chat moves', async () => {
    function MovingChat() {
      const [place, setPlace] = useState('sidebar');
      return (
        <Fragment>
          <Button onClick={() => setPlace('popped out')}>Pop out</Button>
          <ConnectScmBlock
            key={place}
            pendingInput={{
              id: 'input-id',
              input_type: 'connect_scm',
              data: {repo_name: 'acme/app', failure_reason: 'repo_not_in_sentry'},
            }}
            respondToUserInput={jest.fn()}
          />
        </Fragment>
      );
    }
    mockRepoAccess('repo_not_in_sentry');
    render(<MovingChat />, {organization});
    expect(await screen.findByText("Seer can't access acme/app")).toBeInTheDocument();

    // The check after the move doesn't come back.
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: REPO_ACCESS_URL,
      statusCode: 500,
      asyncDelay: new Promise<void>(() => {}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Pop out'}));

    expect(screen.getByText("Seer can't access acme/app")).toBeInTheDocument();
    expect(
      screen.queryByText('Checking whether Seer can access acme/app')
    ).not.toBeInTheDocument();
  });

  describe('after an earlier pause for the same repo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        // The popup's own timers update its state.
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

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

    it("doesn't count a check the earlier pause started", async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      let answerEarlierCheck = () => {};
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'found', connectedAccounts: []},
        asyncDelay: new Promise<void>(resolve => {
          answerEarlierCheck = resolve;
        }),
      });
      render(<Pauses />, {organization});

      // The run paused again before the earlier pause's check came back.
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: REPO_ACCESS_URL,
        body: {status: 'repo_not_in_sentry', connectedAccounts: []},
        asyncDelay: new Promise<void>(() => {}),
      });
      await user.click(screen.getByRole('button', {name: 'Pause again'}));
      answerEarlierCheck();
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Perfect, Seer can access acme/app')
      ).not.toBeInTheDocument();
    });

    it("waits for this pause's check instead of showing the earlier answer", async () => {
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

      expect(
        screen.getByText('Checking whether Seer can access acme/app')
      ).toBeInTheDocument();
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

  it('sends the corrected name', async () => {
    mockRepoAccess('repo_not_in_sentry');
    const respondToUserInput = renderBlock({failureReason: 'repo_not_in_sentry'});

    await userEvent.click(await screen.findByRole('button', {name: 'Correct repo name'}));
    const field = screen.getByRole('textbox', {name: 'Repository name'});
    expect(field).toHaveValue('acme/app');
    await userEvent.clear(field);
    await userEvent.type(field, 'acme/real');
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(respondToUserInput).toHaveBeenCalledWith('input-id', {
      decision: 'correct_repo',
      repo_name: 'acme/real',
    });
  });
});
