import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfileEventEvidence} from 'sentry/components/events/profileEventEvidence';
import {IssueCategory, IssueType} from 'sentry/types';

describe('ProfileEventEvidence', function () {
  const defaultProps = {
    event: TestStubs.Event({
      id: 'event-id',
      occurrence: {
        evidenceDisplay: [{name: 'Evidence name', value: 'Evidence value'}],
        evidenceData: {frameName: 'some_func', framePackage: 'something.dll'},
      },
    }),
    group: TestStubs.Group({
      issueCategory: IssueCategory.PROFILE,
      issueType: IssueType.PROFILE_BLOCKED_THREAD,
    }),
    projectSlug: 'project-slug',
  };

  it('displays profile ID and data in evidence display', function () {
    render(<ProfileEventEvidence {...defaultProps} />);

    expect(screen.getByRole('cell', {name: 'Profile ID'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'event-id'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Evidence name'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Evidence value'})).toBeInTheDocument();
  });

  it('correctly links to the profile frame', function () {
    render(<ProfileEventEvidence {...defaultProps} />);

    expect(screen.getByRole('link', {name: 'event-id'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/project-slug/event-id/flamechart/?frameName=some_func&framePackage=something.dll&referrer=issue-details'
    );
  });
});
