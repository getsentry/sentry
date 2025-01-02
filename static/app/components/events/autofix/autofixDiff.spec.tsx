import {AutofixDiffFilePatch} from 'sentry-fixture/autofixDiffFilePatch';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixDiff', function () {
  const defaultProps = {
    diff: [AutofixDiffFilePatch()],
    groupId: '1',
    runId: '1',
    editable: true,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    (addErrorMessage as jest.Mock).mockClear();
  });

  it('displays a modified file diff correctly', function () {
    render(<AutofixDiff {...defaultProps} />);

    // File path
    expect(
      screen.getByText('src/sentry/processing/backpressure/memory.py')
    ).toBeInTheDocument();

    // Lines changed
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();

    // Hunk section header
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          '@@ -47,7 +47,7 @@  def get_memory_usage(node_id: str, info: Mapping[str, Any]) -> ServiceMemory:'
        )
      )
    ).toBeInTheDocument();

    // One removed line
    const removedLine = screen.getByTestId('line-removed');
    expect(
      within(removedLine).getByText(
        textWithMarkupMatcher(
          'memory_available = info.get("maxmemory", 0) or info["total_system_memory"]'
        )
      )
    ).toBeInTheDocument();

    // One added line
    const addedLine = screen.getByTestId('line-added');
    expect(
      within(addedLine).getByText(
        textWithMarkupMatcher(
          'memory_available = info.get("maxmemory", 0) or info.get("total_system_memory", 0)'
        )
      )
    ).toBeInTheDocument();

    // 6 context lines
    expect(screen.getAllByTestId('line-context')).toHaveLength(6);
  });

  it('can collapse a file diff', async function () {
    render(<AutofixDiff {...defaultProps} />);

    expect(screen.getAllByTestId('line-context')).toHaveLength(6);

    // Clicking toggle hides file context
    await userEvent.click(screen.getByRole('button', {name: 'Toggle file diff'}));
    expect(screen.queryByTestId('line-context')).not.toBeInTheDocument();

    // Clicking again shows file context
    await userEvent.click(screen.getByRole('button', {name: 'Toggle file diff'}));
    expect(screen.getAllByTestId('line-context')).toHaveLength(6);
  });

  it('can edit changes', async function () {
    render(<AutofixDiff {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Edit changes'}));

    expect(
      screen.getByText('Editing src/sentry/processing/backpressure/memory.py')
    ).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New content');

    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(
        screen.queryByText('Editing src/sentry/processing/backpressure/memory.py')
      ).not.toBeInTheDocument();
    });
  });

  it('can reject changes', async function () {
    render(<AutofixDiff {...defaultProps} />);

    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Reject changes'}));

    await waitFor(() => {
      expect(screen.queryByTestId('line-added')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('line-removed')).not.toBeInTheDocument();
  });

  it('shows error message on failed edit', async function () {
    render(<AutofixDiff {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Edit changes'}));

    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New content');

    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
      statusCode: 500,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Something went wrong when updating changes.'
      );
    });
  });

  it('does not show edit buttons when editable is false', function () {
    render(<AutofixDiff {...defaultProps} editable={false} />);

    expect(screen.queryByRole('button', {name: 'Edit changes'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Reject changes'})
    ).not.toBeInTheDocument();

    // Ensure the diff content is still visible
    expect(
      screen.getByText('src/sentry/processing/backpressure/memory.py')
    ).toBeInTheDocument();
    expect(screen.getByTestId('line-added')).toBeInTheDocument();
    expect(screen.getByTestId('line-removed')).toBeInTheDocument();
  });
});
