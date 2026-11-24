import {useCallback, useState} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

interface HeldOnboarding {
  projectId: string;
  selectionKey: string;
}

interface SpansOnboardingProject {
  /**
   * Clears the held project, so the page can show the project's data.
   */
  onFirstTraceReady: () => void;
  project: Project | undefined;
}

/**
 * The project to show tracing setup for. A project's first-transaction flag is set at
 * ingest, before its spans can be queried, so the project stays here after the flag
 * flips until the empty state reports its first trace is ready or the selection changes.
 */
export function useSpansOnboardingProject(): SpansOnboardingProject {
  const onboardingProject = useOnboardingProject();
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const selectionKey = selection.projects.join(',');
  const [held, setHeld] = useState<HeldOnboarding | null>(null);

  if (
    onboardingProject &&
    (held?.projectId !== onboardingProject.id || held.selectionKey !== selectionKey)
  ) {
    setHeld({projectId: onboardingProject.id, selectionKey});
  }

  const onFirstTraceReady = useCallback(() => setHeld(null), []);

  if (onboardingProject) {
    return {project: onboardingProject, onFirstTraceReady};
  }

  const heldProject =
    held?.selectionKey === selectionKey
      ? projects.find(p => p.id === held.projectId)
      : undefined;
  return {project: heldProject, onFirstTraceReady};
}
