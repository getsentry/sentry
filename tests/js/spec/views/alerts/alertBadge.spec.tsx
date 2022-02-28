import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertBadge from 'sentry/components/alertBadge';
import {IncidentStatus} from 'sentry/views/alerts/types';

describe('AlertBadge', () => {
  it('displays status', () => {
    render(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });
  it('hides status text', () => {
    render(<AlertBadge hideText status={IncidentStatus.CLOSED} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });
  it('can be an issue badge', () => {
    render(<AlertBadge isIssue />);
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });
});
