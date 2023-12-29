import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render} from 'sentry-test/reactTestingLibrary';

import QuickTrace from 'sentry/views/issueDetails/quickTrace';

describe('IssueQuickTrace', () => {
  const defaultProps = {
    organization: OrganizationFixture({features: ['performance-view']}),
    event: EventFixture({contexts: {trace: {trace_id: 100}}}),
    group: GroupFixture(),
    location: LocationFixture(),
  };

  it('renders nothing without performance-view flag', () => {
    const {container} = render(
      <QuickTrace {...defaultProps} organization={OrganizationFixture()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing if event does not have a trace context', () => {
    const {container} = render(
      <QuickTrace {...defaultProps} event={EventFixture({contexts: {}})} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
