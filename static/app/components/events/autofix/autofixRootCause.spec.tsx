import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import {AutofixStatus} from 'sentry/components/events/autofix/types';

describe('AutofixRootCause', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/update/',
      method: 'POST',
      body: {success: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {integrations: []},
    });
  });

  afterEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
    jest.clearAllTimers();
  });

  const defaultProps = {
    causes: [AutofixRootCauseData()],
    groupId: '1',
    rootCauseSelection: null,
    runId: '101',
    status: AutofixStatus.COMPLETED,
  } satisfies React.ComponentProps<typeof AutofixRootCause>;

  it('can view a relevant code snippet', async () => {
    render(<AutofixRootCause {...defaultProps} />);

    // Wait for initial render and animations
    expect(await screen.findByText('Root Cause')).toBeInTheDocument();

    expect(
      await screen.findByText(defaultProps.causes[0]!.root_cause_reproduction![0]!.title)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('autofix-root-cause-timeline-item-0'));

    // Wait for code snippet to appear with increased timeout for animation
    expect(
      await screen.findByText(
        defaultProps.causes[0]!.root_cause_reproduction![0]!.code_snippet_and_analysis
      )
    ).toBeInTheDocument();
  });

  it('shows graceful error state when there are no causes', async () => {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [],
          terminationReason: 'The error comes from outside the codebase.',
        }}
      />
    );

    // Wait for error state to render
    expect(
      await screen.findByText(
        'No root cause found. The error comes from outside the codebase.'
      )
    ).toBeInTheDocument();
  });

  it('shows selected root cause when rootCauseSelection is provided', async () => {
    const selectedCause = AutofixRootCauseData();
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          rootCauseSelection: {
            cause_id: selectedCause.id,
          },
        }}
      />
    );

    // Wait for selected root cause to render
    expect(await screen.findByText('Root Cause')).toBeInTheDocument();

    expect(
      await screen.findByText(selectedCause.root_cause_reproduction![0]!.title)
    ).toBeInTheDocument();
  });

  it('saves preference when clicking Find Solution with Seer', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [
          {
            id: 'cursor-integration-id',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    render(<AutofixRootCause {...defaultProps} />);

    await userEvent.click(
      await screen.findByRole('button', {name: 'Find Solution with Seer'})
    );

    expect(JSON.parse(localStorage.getItem('autofix:rootCauseActionPreference')!)).toBe(
      'seer_solution'
    );
  });

  it('saves preference when clicking Cursor agent', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [
          {
            id: 'cursor-integration-id',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      method: 'POST',
      body: {success: true},
    });

    render(<AutofixRootCause {...defaultProps} />);

    // Find and open the dropdown
    const dropdownTrigger = await screen.findByRole('button', {
      name: 'More solution options',
    });
    await userEvent.click(dropdownTrigger);

    // Click the Cursor option in the dropdown
    await userEvent.click(await screen.findByText('Send to Cursor'));

    expect(JSON.parse(localStorage.getItem('autofix:rootCauseActionPreference')!)).toBe(
      'cursor:cursor-integration-id'
    );
  });

  it('shows Seer as primary button by default', async () => {
    render(<AutofixRootCause {...defaultProps} />);

    expect(
      await screen.findByRole('button', {name: 'Find Solution'})
    ).toBeInTheDocument();
  });

  it('shows Seer as primary when preference is seer', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [
          {
            id: 'cursor-integration-id',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    localStorage.setItem(
      'autofix:rootCauseActionPreference',
      JSON.stringify('seer_solution')
    );

    render(<AutofixRootCause {...defaultProps} />);

    expect(
      await screen.findByRole('button', {name: 'Find Solution with Seer'})
    ).toBeInTheDocument();
  });

  it('shows Cursor as primary when preference is cursor', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [
          {
            id: 'cursor-integration-id',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    localStorage.setItem(
      'autofix:rootCauseActionPreference',
      JSON.stringify('cursor:cursor-integration-id')
    );

    render(<AutofixRootCause {...defaultProps} />);

    expect(
      await screen.findByRole('button', {name: 'Send to Cursor'})
    ).toBeInTheDocument();

    // Verify Seer option is in the dropdown
    const dropdownTrigger = await screen.findByRole('button', {
      name: 'More solution options',
    });
    await userEvent.click(dropdownTrigger);

    expect(await screen.findByText('Find Solution with Seer')).toBeInTheDocument();
  });

  it('both options accessible in dropdown', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [
          {
            id: 'cursor-integration-id',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    render(<AutofixRootCause {...defaultProps} />);

    // Primary button is Seer (when cursor integration exists, show "with Seer" to distinguish)
    expect(
      await screen.findByRole('button', {name: 'Find Solution with Seer'})
    ).toBeInTheDocument();

    // Open dropdown to find Cursor option
    const dropdownTrigger = await screen.findByRole('button', {
      name: 'More solution options',
    });
    await userEvent.click(dropdownTrigger);

    expect(await screen.findByText('Send to Cursor')).toBeInTheDocument();
  });
});
