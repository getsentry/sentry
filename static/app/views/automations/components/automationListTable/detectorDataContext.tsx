import {createContext, useContext, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

interface DetectorDataContextValue {
  detectorsById: Map<string, Detector>;
  isError: boolean;
  isPending: boolean;
}

const DetectorDataContext = createContext<DetectorDataContextValue | null>(null);

export function useDetectorDataContext() {
  return useContext(DetectorDataContext);
}

export function DetectorDataContextProvider({
  detectorIds,
  children,
}: {
  children: React.ReactNode;
  detectorIds: string[];
}) {
  const organization = useOrganization();
  const queryEnabled = detectorIds.length > 0;
  const {
    data,
    isPending: queryIsPending,
    isError,
  } = useQuery({
    ...detectorListApiOptions(organization, {
      ids: detectorIds,
      limit: detectorIds.length,
    }),
    enabled: queryEnabled,
  });
  const isPending = queryEnabled && queryIsPending;

  const detectorsById = useMemo(() => {
    const map = new Map<string, Detector>();
    if (!data) {
      return map;
    }
    for (const detector of data) {
      map.set(detector.id, detector);
    }
    return map;
  }, [data]);

  const value = useMemo(
    () => ({detectorsById, isError, isPending}),
    [detectorsById, isError, isPending]
  );

  return <DetectorDataContext value={value}>{children}</DetectorDataContext>;
}
