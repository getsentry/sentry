import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {useEngagedViewTracking} from './useEngagedViewTracking';

jest.mock('sentry/utils/analytics');

describe('useEngagedViewTracking', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('records engaged view event after 10 seconds', () => {
    renderHook(() =>
      useEngagedViewTracking({
        groupId: '123',
        projectId: '456',
        organization,
        issueType: 'error',
      })
    );

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
    const {unmount} = renderHook(() =>
      useEngagedViewTracking({
        groupId: '123',
        projectId: '456',
        organization,
        issueType: 'error',
      })
    );

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
    renderHook(() =>
      useEngagedViewTracking({
        groupId: '123',
        projectId: '456',
        organization,
        issueType: 'error',
      })
    );

    // Advance timer by 10 seconds to trigger first event
    jest.advanceTimersByTime(10000);

    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Advance timer by another 10 seconds
    jest.advanceTimersByTime(10000);

    // Should still only have tracked once
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
  });

  it('resets timer when group changes', () => {
    const {rerender} = renderHook(
      ({groupId}) =>
        useEngagedViewTracking({
          groupId,
          projectId: '456',
          organization,
          issueType: 'error',
        }),
      {
        initialProps: {groupId: '123'},
      }
    );

    // Advance timer by 5 seconds
    jest.advanceTimersByTime(5000);

    // Verify not yet tracked
    expect(trackAnalytics).not.toHaveBeenCalled();

    // Change to a different group
    rerender({groupId: '789'});

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
    const {rerender} = renderHook(
      ({groupId}) =>
        useEngagedViewTracking({
          groupId,
          projectId: '456',
          organization,
          issueType: 'error',
        }),
      {
        initialProps: {groupId: '123'},
      }
    );

    // Advance timer by 10 seconds to trigger event for first group
    jest.advanceTimersByTime(10000);

    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue.engaged_view',
      expect.objectContaining({group_id: 123})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Change to a different group
    rerender({groupId: '789'});

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
