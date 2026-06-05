import {createContext, useContext, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

interface IssueStreamDetectorContextValue {
  detectorsByProject: Map<string, Detector[]>;
  isPending: boolean;
}

const IssueStreamDetectorContext = createContext<IssueStreamDetectorContextValue | null>(
  null
);

export function useIssueStreamDetectorContext() {
  return useContext(IssueStreamDetectorContext);
}

export function IssueStreamDetectorContextProvider({
  projectIds,
  children,
}: {
  children: React.ReactNode;
  projectIds: string[];
}) {
  const organization = useOrganization();
  const {data, isPending} = useQuery({
    ...detectorListApiOptions(organization, {
      query: 'type:issue_stream',
      projects: projectIds.map(Number),
      includeIssueStreamDetectors: true,
    }),
    staleTime: Infinity,
    enabled: projectIds.length > 0,
  });

  const detectorsByProject = useMemo(() => {
    const map = new Map<string, Detector[]>();
    if (!data) {
      return map;
    }
    for (const detector of data) {
      const existing = map.get(detector.projectId);
      if (existing) {
        existing.push(detector);
      } else {
        map.set(detector.projectId, [detector]);
      }
    }
    return map;
  }, [data]);

  const value = useMemo(
    () => ({detectorsByProject, isPending}),
    [detectorsByProject, isPending]
  );

  return (
    <IssueStreamDetectorContext value={value}>{children}</IssueStreamDetectorContext>
  );
}
