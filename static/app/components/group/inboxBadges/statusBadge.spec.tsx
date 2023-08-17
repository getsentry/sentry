import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupStatusBadge} from 'sentry/components/group/inboxBadges/statusBadge';
import {GroupStatus, GroupSubstatus} from 'sentry/types';

describe('GroupStatusBadge', () => {
  it('should display archived until escalating as a tooltip', async () => {
    render(
      <GroupStatusBadge
        status={GroupStatus.IGNORED}
        substatus={GroupSubstatus.ARCHIVED_UNTIL_ESCALATING}
      />
    );
    await userEvent.hover(screen.getByText('Archived'));
    expect(await screen.findByText('Archived until escalating')).toBeInTheDocument();
  });
  it('should display new', () => {
    render(
      <GroupStatusBadge status={GroupStatus.UNRESOLVED} substatus={GroupSubstatus.NEW} />
    );
    expect(screen.getByText('New')).toBeInTheDocument();
  });
  it('should display escalating', () => {
    render(
      <GroupStatusBadge
        status={GroupStatus.UNRESOLVED}
        substatus={GroupSubstatus.ESCALATING}
      />
    );
    expect(screen.getByText('Escalating')).toBeInTheDocument();
  });
  it('should display regression', () => {
    render(
      <GroupStatusBadge
        status={GroupStatus.UNRESOLVED}
        substatus={GroupSubstatus.REGRESSED}
      />
    );
    expect(screen.getByText('Regressed')).toBeInTheDocument();
  });
  it('should display resolved', () => {
    render(<GroupStatusBadge status={GroupStatus.RESOLVED} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });
});
