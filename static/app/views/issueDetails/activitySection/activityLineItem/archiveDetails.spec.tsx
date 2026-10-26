import {Fragment} from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import type {GroupActivitySetIgnored} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import {getArchiveDetails} from 'sentry/views/issueDetails/activitySection/activityLineItem/archiveDetails';

type ArchiveData = GroupActivitySetIgnored['data'];

function renderDetails(data: ArchiveData) {
  return render(<Fragment>{getArchiveDetails(data, IssueCategory.ERROR)}</Fragment>);
}

describe('getArchiveDetails', () => {
  it.each([
    [{ignoreDuration: 10}, 'for 10 minutes'],
    [{ignoreCount: 50, ignoreWindow: 10}, 'until 50 events occur within 10 minutes'],
    [{ignoreCount: 1}, 'until 1 more event occurs'],
    [
      {ignoreUserCount: 50, ignoreUserWindow: 10},
      'until 50 users are affected within 10 minutes',
    ],
    [{ignoreUserCount: 1}, 'until 1 more user is affected'],
    [{ignoreUntilEscalating: true}, 'until it escalates'],
    [{}, 'forever'],
  ] satisfies Array<[ArchiveData, string]>)('formats %j as %s', (data, expected) => {
    const {container} = renderDetails(data);

    expect(container).toHaveTextContent(expected);
  });

  it('formats an archive date', () => {
    const {container} = renderDetails({ignoreUntil: '2025-01-01T00:00:00Z'});

    expect(container).toHaveTextContent(/until Jan 1, 2025/);
  });

  it('omits forever details for feedback', () => {
    expect(getArchiveDetails({}, IssueCategory.FEEDBACK)).toBeNull();
  });
});
