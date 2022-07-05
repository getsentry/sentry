import {useEffect, useState} from 'react';

import {t} from 'sentry/locale';
import {SeriesApi} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

import {projectStatsToSeries} from './projectStatsToSeries';

function useProjectStats({orgSlug, projectId, interval, statsPeriod}) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [projectStats, setProjectStats] = useState<SeriesApi | undefined>(undefined);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
          query: {
            category: 'transaction',
            field: 'sum(quantity)',
            groupBy: 'outcome',
            project: projectId,
            interval,
            statsPeriod,
          },
        });

        setProjectStats(response);
        setLoading(false);
      } catch (err) {
        const errorMessage = t('Unable to load project stats');
        handleXhrErrorResponse(errorMessage)(err);
        setError(errorMessage);
        setLoading(false);
      }
    }
    fetchStats();
  }, [api, projectId, orgSlug, interval, statsPeriod]);

  return {
    loading,
    error,
    projectStats,
    projectStatsSeries: projectStatsToSeries(projectStats),
  };
}

export default useProjectStats;
