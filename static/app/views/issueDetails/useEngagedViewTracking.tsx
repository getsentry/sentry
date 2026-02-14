import {useEffect, useEffectEvent, useRef} from 'react';

import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

const ENGAGED_VIEW_THRESHOLD_MS = 10000;

interface UseEngagedViewTrackingParams {
  group: Group;
  project: Project;
}

/**
 * Tracks an "engaged view" analytics event when a user spends at least 10 seconds
 * viewing an issue. This helps measure issue triage engagement.
 *
 * Each 10+ second viewing session is tracked separately. If the user navigates
 * away before 10 seconds, no event is recorded. If they return later and view
 * the same issue for another 10+ seconds, a new event is recorded.
 */
export function useEngagedViewTracking({group, project}: UseEngagedViewTrackingParams) {
  const organization = useOrganization();
  const trackedGroupId = useRef<string | null>(null);
  const trackEngagedView = useEffectEvent(() => {
    trackAnalytics('issue.engaged_view', {
      organization,
      group_id: parseInt(group.id, 10),
      project_id: parseInt(project.id, 10),
      issue_type: group.issueType,
    });
  });

  useEffect(() => {
    // Only track once per group
    if (trackedGroupId.current === group.id) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (trackedGroupId.current !== group.id) {
        trackedGroupId.current = group.id;
        trackEngagedView();
      }
    }, ENGAGED_VIEW_THRESHOLD_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [group.id]);
}
