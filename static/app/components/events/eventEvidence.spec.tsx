import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventEvidence} from 'sentry/components/events/eventEvidence';

describe('EventEvidence', () => {
  const event = EventFixture({
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
    group: GroupFixture(),
    project: ProjectFixture({slug: 'project-slug'}),
  };

  it('renders nothing when evidence display is empty', () => {
    const {container} = render(
      <EventEvidence
        {...defaultProps}
        event={EventFixture({occurrence: {evidenceDisplay: []}})}
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
