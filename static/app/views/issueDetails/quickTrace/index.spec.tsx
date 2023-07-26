import {render} from 'sentry-test/reactTestingLibrary';

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
});
