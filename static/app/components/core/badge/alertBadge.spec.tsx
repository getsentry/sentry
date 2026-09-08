import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AlertBadge} from '@sentry/scraps/badge';

import {IncidentStatus} from 'sentry/views/alerts/types';

describe('AlertBadge', () => {
  it('renders', () => {
    render(<AlertBadge status={IncidentStatus.CLOSED} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });
});
