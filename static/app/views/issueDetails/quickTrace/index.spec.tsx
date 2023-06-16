import {render, screen} from 'sentry-test/reactTestingLibrary';

import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTrace from 'sentry/views/issueDetails/quickTrace';

describe('IssueQuickTrace', () => {
  const defaultProps = {
    organization: TestStubs.Organization({features: ['performance-view']}),
    event: TestStubs.Event({contexts: {trace: {trace_id: 100}}}),
    group: TestStubs.Group(),
    location: TestStubs.location(),
  };

  it('renders nothing without performance-view flag', () => {
    const {container} = render(
      <QuickTrace {...defaultProps} organization={TestStubs.Organization()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing if event does not have a trace context', () => {
    const {container} = render(
      <QuickTrace {...defaultProps} event={TestStubs.Event({contexts: {}})} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a placeholder if event has a trace context but finds nothing', () => {
    MockApiClient.addMockResponse({});

    render(
      <QuickTraceContext.Provider value={undefined}>
        <QuickTrace {...defaultProps} />
      </QuickTraceContext.Provider>
    );

    expect(screen.getByTestId('missing-trace-placeholder')).toBeInTheDocument();
  });
});
