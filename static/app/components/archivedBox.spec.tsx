import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupSubstatus} from 'sentry/types/group';

import {ArchivedBox} from './archivedBox';

describe('ArchivedBox', () => {
  it('handles ignoreUntil', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}}
      />
    );
    expect(screen.getByText(/This issue has been archived until/)).toBeInTheDocument();
  });
  it('handles ignoreCount', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100}}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreCount with ignoreWindow', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreCount: 100, ignoreWindow: 1}}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it occurs/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100}}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount with ignoreUserWindow', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles archived forever', () => {
    render(
      <ArchivedBox substatus={GroupSubstatus.ARCHIVED_FOREVER} statusDetails={{}} />
    );
    expect(screen.getByText(/This issue has been archived forever/)).toBeInTheDocument();
  });
  it('handles archived until escalating', () => {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_ESCALATING}
        statusDetails={{ignoreUntilEscalating: true}}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it escalates/)
    ).toBeInTheDocument();
  });
});
