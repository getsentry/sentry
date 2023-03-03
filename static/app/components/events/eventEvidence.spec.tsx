import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventEvidence} from 'sentry/components/events/eventEvidence';

describe('EventEvidence', () => {
  const event = TestStubs.Event({
    occurrence: {
      evidenceData: {},
      evidenceDisplay: [
        {
          name: 'Transaction',
          value: '/api/0/transaction-test-endpoint/',
          important: false,
        },
      ],
      fingerprint: [],
      id: '',
      issueTitle: '',
      resourceId: '',
      subtitle: '',
      detectionTime: '',
      eventId: '',
    },
  });

  const defaultProps = {
    event,
    group: TestStubs.Group(),
    projectSlug: 'project-slug',
  };

  it('renders nothing when evidence display is empty', () => {
    const {container} = render(
      <EventEvidence
        {...defaultProps}
        event={TestStubs.Event({occurrence: {evidenceDisplay: []}})}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders evidenceDisplay data in a key/value table', () => {
    render(<EventEvidence {...defaultProps} />);

    expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {
        name: '/api/0/transaction-test-endpoint/',
      })
    ).toBeInTheDocument();
  });
});
