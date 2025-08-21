import {useMemo} from 'react';

import {useQuery} from 'sentry/utils/queryClient';

type IncidentOutageData = {
  data: Array<{
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
  }>;
};

export function useIncidentOutages() {
  const randomOngoingOutage = useMemo(() => {
    const randomNumber = Math.floor(Math.random() * (25 - 1 + 1)) + 1;

    return randomNumber <= 3 ? null : undefined;
  }, []);

  const randomPageNumber = useMemo(
    () => Math.floor(Math.random() * (100 - 1 + 1)) + 1,
    []
  );

  const {data: incidentData, isPending: isPendingIncidentData} =
    useQuery<IncidentOutageData>({
      queryKey: ['incident-outages', randomPageNumber],
      queryFn: async () => {
        const response = await fetch(`/outages?limit=10&page=${randomPageNumber}`);
        const data = await response.json();
        return data;
      },
      select: data => {
        return {
          data: data?.data?.map(outage =>
            randomOngoingOutage === null ? {...outage, end: null} : outage
          ),
        };
      },
    });

  return {incidentData, isPendingIncidentData};
}
