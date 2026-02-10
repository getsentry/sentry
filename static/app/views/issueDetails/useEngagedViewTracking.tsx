import {useEffect, useEffectEvent, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

const ENGAGED_VIEW_THRESHOLD_MS = 10000;

interface UseEngagedViewTrackingParams {
  groupId: string;
  issueType: string;
  projectId: string;
}

/**
 * Tracks an "engaged view" analytics event when a user spends at least 10 seconds
 * viewing an issue. This helps measure issue triage engagement.
 *
 * The event is only tracked once per group per component instance. If the user
 * navigates away before 10 seconds, no event is recorded.
 */
export function useEngagedViewTracking({
  groupId,
  projectId,
  issueType,
}: UseEngagedViewTrackingParams) {
  const organization = useOrganization();
  const trackedGroupId = useRef<string | null>(null);
  const trackEngagedView = useEffectEvent(() => {
    trackAnalytics('issue.engaged_view', {
      organization,
      group_id: parseInt(groupId, 10),
      project_id: parseInt(projectId, 10),
      issue_type: issueType,
    });
  });

  useEffect(() => {
    // Only track once per group
    if (trackedGroupId.current === groupId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (trackedGroupId.current !== groupId) {
        trackedGroupId.current = groupId;
        trackEngagedView();
      }
    }, ENGAGED_VIEW_THRESHOLD_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [groupId]);
}
