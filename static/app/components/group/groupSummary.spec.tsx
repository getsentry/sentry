import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupSummary} from 'sentry/components/group/groupSummary';

describe('GroupSummary', function () {
  const mockSummaryData = {
    groupId: '1',
    whatsWrong: 'Test whats wrong',
    trace: 'Test trace',
    possibleCause: 'Test possible cause',
    headline: 'Test headline',
  };

  it('renders the summary with all sections', function () {
    render(<GroupSummary data={mockSummaryData} isError={false} isPending={false} />);

    expect(screen.getByText("What's wrong")).toBeInTheDocument();
    expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.getByText('In the trace')).toBeInTheDocument();
    expect(screen.getByText('Test trace')).toBeInTheDocument();
    expect(screen.getByText('Possible cause')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
  });

  it('shows loading state', function () {
    render(<GroupSummary data={undefined} isError={false} isPending />);

    // Should show loading placeholders
    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(2);
  });

  it('shows error state', function () {
    render(<GroupSummary data={undefined} isError isPending={false} />);

    expect(screen.getByText('Error loading summary')).toBeInTheDocument();
  });

  it('hides cards with no content', function () {
    const dataWithNulls = {
      ...mockSummaryData,
      trace: null,
    };

    render(<GroupSummary data={dataWithNulls} isError={false} isPending={false} />);

    expect(screen.getByText("What's wrong")).toBeInTheDocument();
    expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.queryByText('In the trace')).not.toBeInTheDocument();
    expect(screen.getByText('Possible cause')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
  });

  it('renders in preview mode', function () {
    render(
      <GroupSummary data={mockSummaryData} isError={false} isPending={false} preview />
    );

    expect(screen.getByText("What's wrong")).toBeInTheDocument();
    expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
  });
});
