import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {AutofixSummary} from 'sentry/components/group/groupSummaryWithAutofix';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/components/events/autofix/useAutofix');
jest.mock('sentry/utils/analytics');

describe('AutofixSummary', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({id: '1', shortId: 'TEST-1'});
  const user = UserFixture();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

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

  it('renders feedback buttons for root cause card', async () => {
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
      screen.getByRole('button', {name: 'This was helpful'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'This was not helpful'})
    ).toBeInTheDocument();
  });

  it('renders feedback buttons for solution card', async () => {
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
      {organization, user}
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
      {organization, user}
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

  it('does not render feedback buttons when loading', async () => {
    render(
      <AutofixSummary
        group={group}
        rootCauseDescription="This is the root cause"
        rootCauseCopyText="Root cause text"
        solutionDescription={null}
        solutionCopyText={null}
        solutionIsLoading={true}
        codeChangesDescription={null}
        codeChangesIsLoading={false}
      />,
      {organization}
    );

    // Root cause should have feedback buttons
    expect(
      screen.getByRole('button', {name: 'This was helpful'})
    ).toBeInTheDocument();

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
      {organization, user}
    );

    const thumbsUpButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    // Click the second thumbs up (solution)
    await userEvent.click(thumbsUpButtons[1]);

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
      {organization, user}
    );

    const thumbsUpButtons = screen.getAllByRole('button', {name: 'This was helpful'});
    // Click the third thumbs up (code changes)
    await userEvent.click(thumbsUpButtons[2]);

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

  it('does not render feedback buttons when run_id is missing', async () => {
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
