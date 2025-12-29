import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {AutofixSummary} from 'sentry/components/group/groupSummaryWithAutofix';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/components/events/autofix/useAutofix');
jest.mock('sentry/utils/analytics');

describe('AutofixSummary', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture({id: '1', shortId: 'TEST-1'});
  const user = UserFixture();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', user);

    jest.mocked(useAutofixData).mockReturnValue({
      data: {
        run_id: 'test-run-id',
        status: 'COMPLETED',
        steps: [],
      },
      isPending: false,
      isError: false,
      error: null,
    } as any);
  });

  it('renders feedback buttons for root cause card', () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    expect(screen.getByRole('button', {name: 'This was helpful'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'This was not helpful'})
    ).toBeInTheDocument();
  });

  it('renders feedback buttons for solution card', () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription="This is the solution"
        solutionCopyText="Solution text"
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const helpfulButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    expect(helpfulButtons).toHaveLength(2); // One for root cause, one for solution
  });

  it('tracks analytics event when thumbs up is clicked', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const thumbsUpButton = screen.getByRole('button', {name: 'This was helpful'});
    await userEvent.click(thumbsUpButton);

    await waitFor(() => {
      expect(trackAnalytics).toHaveBeenCalledWith(
        'seer.autofix.feedback_submitted',
        expect.objectContaining({
          step_type: 'root_cause',
          positive: true,
          group_id: '1',
          autofix_run_id: 'test-run-id',
          user_id: user.id,
          organization,
        })
      );
    });
  });

  it('tracks analytics event when thumbs down is clicked', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const thumbsDownButton = screen.getByRole('button', {
      name: 'This was not helpful',
    });
    await userEvent.click(thumbsDownButton);

    await waitFor(() => {
      expect(trackAnalytics).toHaveBeenCalledWith(
        'seer.autofix.feedback_submitted',
        expect.objectContaining({
          step_type: 'root_cause',
          positive: false,
          group_id: '1',
          autofix_run_id: 'test-run-id',
          user_id: user.id,
          organization,
        })
      );
    });
  });

  it('shows "Thanks!" message after feedback is submitted', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const thumbsUpButton = screen.getByRole('button', {name: 'This was helpful'});
    await userEvent.click(thumbsUpButton);

    expect(await screen.findByText('Thanks!')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'This was helpful'})
    ).not.toBeInTheDocument();
  });

  it('does not render feedback buttons when loading', () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    // Root cause should have feedback buttons
    expect(screen.getByRole('button', {name: 'This was helpful'})).toBeInTheDocument();

    // Solution should not have feedback buttons because it's loading
    const helpfulButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    expect(helpfulButtons).toHaveLength(1);
  });

  it('tracks different step_type for solution feedback', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription="This is the solution"
        solutionCopyText="Solution text"
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const thumbsUpButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    // Click the second thumbs up (solution)
    const secondButton = thumbsUpButtons[1];
    if (!secondButton) {
      throw new Error('Second thumbs up button not found');
    }
    await userEvent.click(secondButton);

    await waitFor(() => {
      expect(trackAnalytics).toHaveBeenCalledWith(
        'seer.autofix.feedback_submitted',
        expect.objectContaining({
          step_type: 'solution',
          positive: true,
        })
      );
    });
  });

  it('tracks changes step_type for code changes feedback', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription="This is the solution"
        solutionCopyText="Solution text"
        solutionIsLoading={false}
        codeChangesDescription="These are the code changes"
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    const thumbsUpButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    // Click the third thumbs up (code changes)
    const thirdButton = thumbsUpButtons[2];
    if (!thirdButton) {
      throw new Error('Third thumbs up button not found');
    }
    await userEvent.click(thirdButton);

    await waitFor(() => {
      expect(trackAnalytics).toHaveBeenCalledWith(
        'seer.autofix.feedback_submitted',
        expect.objectContaining({
          step_type: 'changes',
          positive: true,
        })
      );
    });
  });

  it('does not render feedback buttons when run_id is missing', () => {
    jest.mocked(useAutofixData).mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={false}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    expect(
      screen.queryByRole('button', {name: 'This was helpful'})
    ).not.toBeInTheDocument();
  });
});
