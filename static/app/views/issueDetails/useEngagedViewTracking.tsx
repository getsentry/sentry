import {useEffect, useRef} from 'react';

import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

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
  const latestRef = useRef<{
    group: Group;
    organization: Organization;
    project: Project;
  }>({organization, group, project});

  // Keep the ref up to date with the latest values on every render
  latestRef.current = {organization, group, project};

  useEffect(() => {
    // Only track once per group
    if (trackedGroupId.current === group.id) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const latest = latestRef.current;
      if (trackedGroupId.current !== latest.group.id) {
        trackedGroupId.current = latest.group.id;
        trackAnalytics('issue.engaged_view', {
          organization: latest.organization,
          group_id: parseInt(latest.group.id, 10),
          project_id: parseInt(latest.project.id, 10),
          issue_type: latest.group.issueType,
        });
      }
    }, ENGAGED_VIEW_THRESHOLD_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [group.id]);
}
