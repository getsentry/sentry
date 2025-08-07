import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/update/',
      method: 'POST',
      body: {success: true},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllTimers();
  });

  const defaultProps = {
    causes: [AutofixRootCauseData()],
    groupId: '1',
    rootCauseSelection: null,
    runId: '101',
  } satisfies React.ComponentProps<typeof AutofixRootCause>;

  it('can view a relevant code snippet', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    // Wait for initial render and animations
    await waitFor(
      () => {
        expect(screen.getByText('Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(defaultProps.causes[0]!.root_cause_reproduction![0]!.title)
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await userEvent.click(screen.getByTestId('autofix-root-cause-timeline-item-0'));

    // Wait for code snippet to appear with increased timeout for animation
    await waitFor(
      () => {
        expect(
          screen.getByText(
            defaultProps.causes[0]!.root_cause_reproduction![0]!.code_snippet_and_analysis
          )
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });

  it('shows graceful error state when there are no causes', async function () {
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
    await waitFor(
      () => {
        expect(
          screen.getByText(
            'No root cause found. The error comes from outside the codebase.'
          )
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });

  it('shows selected root cause when rootCauseSelection is provided', async function () {
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
    await waitFor(
      () => {
        expect(screen.getByText('Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(selectedCause.root_cause_reproduction![0]!.title)
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });
});
