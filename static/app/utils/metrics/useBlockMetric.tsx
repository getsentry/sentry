import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {MetricMeta, MRI, Project} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {getMetricsMetaQueryKey} from './useMetricsMeta';

type BlockMetricResponse = [MetricMeta[], unknown, unknown] | undefined;

interface MetricMetricMutationData {
  mri: MRI;
  operationType: 'blockMetric' | 'unblockMetric';
}

interface MetricTagsMutationData {
  mri: MRI;
  operationType: 'blockTags' | 'unblockTags';
  tags: string[];
}

type BlockMutationData = MetricMetricMutationData | MetricTagsMutationData;

function isTagOp(opts: BlockMutationData): opts is MetricTagsMutationData {
  return 'tags' in opts;
}

export const useBlockMetric = (project: Project) => {
  const api = useApi();
  const {slug} = useOrganization();
  const queryClient = useQueryClient();

  const options = {
    mutationFn: (data: BlockMutationData) => {
      return api.requestPromise(`/projects/${slug}/${project.slug}/metrics/visibility/`, {
        method: 'PUT',
        query: {project: project.id},
        data: {
          metricMri: data.mri,
          project: project.id,
          operationType: data.operationType,
          tags: isTagOp(data) ? data.tags : undefined,
        },
      });
    },
    onSuccess: data => {
      const useCase = getUseCaseFromMRI(data.metricMri);
      const metaQueryKey = getMetricsMetaQueryKey(
        slug,
        {projects: [parseInt(project.id, 10)]},
        useCase ?? 'custom'
      );
      queryClient.setQueryData(
        metaQueryKey,
        (oldData: BlockMetricResponse): BlockMetricResponse => {
          if (!oldData) {
            return undefined;
          }
          const oldMeta = oldData[0];
          const index = oldMeta.findIndex(
            (metric: {mri: MRI}) => metric.mri === data.metricMri
          );

          if (index !== undefined && index !== -1) {
            const newMeta = [...oldMeta];
            newMeta[index] = {
              ...newMeta[index],
              blockingStatus: [{...data, project: project.id}],
            };

            return [newMeta, oldData[1], oldData[2]];
          }
          return oldData;
        }
      );

      addSuccessMessage(t('Metric updated'));

      queryClient.invalidateQueries(metaQueryKey);
    },
    onError: () => {
      addErrorMessage(t('An error occurred while updating the metric'));
    },
  };

  return useMutation(options);
};
