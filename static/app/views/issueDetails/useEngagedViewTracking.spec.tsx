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

    expect(trackAnalytics).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10000);

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

    jest.advanceTimersByTime(5000);
    unmount();
    jest.advanceTimersByTime(10000);

    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it('does not record event twice for the same group', () => {
    renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    jest.advanceTimersByTime(10000);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10000);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
  });

  it('resets timer when group changes', () => {
    const newGroup = GroupFixture({id: '789', issueType: IssueType.ERROR});

    const {rerender} = renderHookWithProviders(useEngagedViewTracking, {
      organization,
      initialProps: {group, project},
    });

    jest.advanceTimersByTime(5000);
    expect(trackAnalytics).not.toHaveBeenCalled();

    rerender({group: newGroup, project});

    // 10s total from start, but only 5s on the new group
    jest.advanceTimersByTime(5000);
    expect(trackAnalytics).not.toHaveBeenCalled();

    // 10s on the new group
    jest.advanceTimersByTime(5000);
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

    jest.advanceTimersByTime(10000);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue.engaged_view',
      expect.objectContaining({group_id: 123})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    rerender({group: newGroup, project});

    jest.advanceTimersByTime(10000);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue.engaged_view',
      expect.objectContaining({group_id: 789})
    );
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
  });
});
