import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Evidence} from 'sentry/components/events/evidence';

describe('Evidence', () => {
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
  };

  it('renders nothing when evidence display is empty', () => {
    const {container} = render(
      <Evidence
        {...defaultProps}
        event={TestStubs.Event({occurrence: {evidenceDisplay: []}})}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders evidenceDisplay data in a key/value table', () => {
    render(<Evidence {...defaultProps} />);

    expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {
        name: '/api/0/transaction-test-endpoint/',
      })
    ).toBeInTheDocument();
  });
});
