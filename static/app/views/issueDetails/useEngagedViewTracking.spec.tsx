import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {IssueType} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';

import {useEngagedViewTracking} from './useEngagedViewTracking';

jest.mock('sentry/utils/analytics');

describe('useEngagedViewTracking', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '456'});
  const group = GroupFixture({id: '123', issueType: IssueType.ERROR});

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('records engaged view event after 10 seconds', () => {
    renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    // Verify event not yet tracked
    expect(trackAnalytics).not.toHaveBeenCalled();

    // Advance timer by 10 seconds
    jest.advanceTimersByTime(10000);

    // Verify event was tracked
    expect(trackAnalytics).toHaveBeenCalledWith('issue.engaged_view', {
      organization,
      group_id: 123,
      project_id: 456,
      issue_type: 'error',
    });
  });

  it('does not record event if unmounted before 10 seconds', () => {
    const {unmount} = renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    // Advance timer by 5 seconds (not enough)
    jest.advanceTimersByTime(5000);

    // Unmount before the 10 second threshold
    unmount();

    // Advance timer past threshold
    jest.advanceTimersByTime(10000);

    // Verify event was NOT tracked
    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it('does not record event twice for the same group', () => {
    renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    // Advance timer by 10 seconds to trigger first event
    jest.advanceTimersByTime(10000);

    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Advance timer by another 10 seconds
    jest.advanceTimersByTime(10000);

    // Should still only have tracked once
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
  });

  it('resets timer when group changes', () => {
    const newGroup = GroupFixture({id: '789', issueType: IssueType.ERROR});

    const {rerender} = renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    // Advance timer by 5 seconds
    jest.advanceTimersByTime(5000);

    // Verify not yet tracked
    expect(trackAnalytics).not.toHaveBeenCalled();

    // Change to a different group
    rerender({group: newGroup, project});

    // Advance timer by another 5 seconds (total 10 from start, but only 5 on new group)
    jest.advanceTimersByTime(5000);

    // Still not tracked - need full 10 seconds on new group
    expect(trackAnalytics).not.toHaveBeenCalled();

    // Advance timer by another 5 seconds to hit 10 seconds on new group
    jest.advanceTimersByTime(5000);

    // Now it should be tracked with the new group ID
    expect(trackAnalytics).toHaveBeenCalledWith('issue.engaged_view', {
      organization,
      group_id: 789,
      project_id: 456,
      issue_type: 'error',
    });
  });

  it('tracks event for new group after tracking previous group', () => {
    const newGroup = GroupFixture({id: '789', issueType: IssueType.ERROR});

    const {rerender} = renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    // Advance timer by 10 seconds to trigger event for first group
    jest.advanceTimersByTime(10000);

    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue.engaged_view',
      expect.objectContaining({group_id: 123})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Change to a different group
    rerender({group: newGroup, project});

    // Advance timer by 10 seconds
    jest.advanceTimersByTime(10000);

    // Should track for the new group
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue.engaged_view',
      expect.objectContaining({group_id: 789})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
  });
});
