import {useMemo} from 'react';

import {useQuery} from 'sentry/utils/queryClient';

interface IncidentOutageData {
  aiSummary: string | null;
  createdAt: string;
  end: string | null;
  host: {
    id: number;
    name: string;
  } | null;
  id: number;
  regions: Array<{
    id: number;
    name: string;
  } | null>;
  severity: string | null;
  start: string;
  updatedAt: string;
}

export function useIncidentOutage(outageId?: number) {
  const localOutageId = useMemo(
    () => outageId ?? Math.floor(Math.random() * (2000 - 0 + 1)) + 0,
    [outageId]
  );

  const randomOngoingOutage = useMemo(() => {
    const randomNumber = Math.floor(Math.random() * (4 - 0 + 1)) + 0;

    return randomNumber <= 3 ? null : undefined;
  }, []);

  const {data: incidentData, isPending: isPendingIncidentData} =
    useQuery<IncidentOutageData>({
      queryKey: ['incident-outage', localOutageId],
      queryFn: async () => {
        const response = await fetch(`/outages/${localOutageId}`);
        const data = await response.json();
        return data;
      },
      select: data => {
        if (randomOngoingOutage === null) {
          return {
            ...data,
            end: null,
          };
        }

        return data;
      },
    });

  return {incidentData, isPendingIncidentData};
}
