import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupSubstatus} from 'sentry/types';
import * as analytics from 'sentry/utils/analytics';

import ArchivedBox from './archivedBox';

describe('ArchivedBox', function () {
  const organization = Organization();
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  it('handles ignoreUntil', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}}
        organization={organization}
      />
    );
    expect(screen.getByText(/This issue has been archived until/)).toBeInTheDocument();
  });
  it('handles ignoreCount', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100}}
        organization={organization}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreCount with ignoreWindow', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreCount: 100, ignoreWindow: 1}}
        organization={organization}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it occurs/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100}}
        organization={organization}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount with ignoreUserWindow', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET}
        statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}}
        organization={organization}
      />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles archived forever', function () {
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_FOREVER}
        statusDetails={{}}
        organization={organization}
      />
    );
    expect(screen.getByText(/This issue has been archived forever/)).toBeInTheDocument();
  });
  it('handles archived until escalating', function () {
    const org_with_escalating = Organization({
      features: ['escalating-issues'],
    });
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_ESCALATING}
        statusDetails={{ignoreUntilEscalating: true}}
        organization={org_with_escalating}
      />,
      {
        organization: org_with_escalating,
      }
    );
    expect(
      screen.getByText(
        /This issue has been archived\. It'll return to your inbox if it escalates/
      )
    ).toBeInTheDocument();
  });
  it('tracks analytics when issue status docs is clicks', async function () {
    const org_with_escalating = Organization({
      features: ['escalating-issues'],
    });
    render(
      <ArchivedBox
        substatus={GroupSubstatus.ARCHIVED_UNTIL_ESCALATING}
        statusDetails={{ignoreUntilEscalating: true}}
        organization={org_with_escalating}
      />,
      {
        organization: org_with_escalating,
      }
    );
    await userEvent.click(screen.getByText('read the docs'));

    expect(analyticsSpy).toHaveBeenCalledWith(
      'issue_details.issue_status_docs_clicked',
      expect.objectContaining({organization: org_with_escalating})
    );
  });
});
