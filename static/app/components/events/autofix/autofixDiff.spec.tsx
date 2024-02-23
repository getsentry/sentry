import {AutofixResultFixture} from 'sentry-fixture/autofixResult';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';

describe('AutofixDiff', function () {
  const defaultProps = {
    fix: AutofixResultFixture(),
  };

  it('displays a modified file diff correctly', function () {
    render(<AutofixDiff {...defaultProps} />);

    // File path
    expect(
      screen.getByText('src/sentry/processing/backpressure/memory.py')
    ).toBeInTheDocument();

    // Hunk section header
    expect(
      screen.getByText(
        'def get_memory_usage(node_id: str, info: Mapping[str, Any]) -> ServiceMemory:'
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
});
