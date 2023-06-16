import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertBadge from 'sentry/components/alertBadge';
import {IncidentStatus} from 'sentry/views/alerts/types';

describe('AlertBadge', () => {
  it('renders', () => {
    render(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });

  it('displays status text', () => {
    render(<AlertBadge withText status={IncidentStatus.CLOSED} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('can be an issue badge', () => {
    render(<AlertBadge withText isIssue />);
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });
});
