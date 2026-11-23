import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IncidentStatus} from 'sentry/views/alerts/types';

import {AlertBadge} from './alertBadge';

describe('AlertBadge', () => {
  it('renders', () => {
    render(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });
});
