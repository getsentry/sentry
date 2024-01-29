import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {MetricMeta, MRI, Project} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export type BlockOperationType =
  | 'blockMetric'
  | 'unblockMetric'
  | 'blockTags'
  | 'unblockTags';

export const useBlockMetric = (mri: MRI, project: Project) => {
  const api = useApi();
  const {slug} = useOrganization();
  const queryClient = useQueryClient();

  const useCase = getUseCaseFromMRI(mri);

  const options = {
    mutationFn: (data: {operationType: BlockOperationType; tags?: string[]}) => {
      return api.requestPromise(`/projects/${slug}/${project.slug}/metrics/visibility/`, {
        method: 'PUT',
        query: {project: project.id},
        data: {metricMri: mri, project: project.id, ...data},
      });
    },
    onSuccess: data => {
      queryClient.setQueryData(
        [
          `/organizations/${slug}/metrics/meta/`,
          {query: {useCase, project: [parseInt(project.id, 10)]}},
        ],
        (
          oldData: [MetricMeta[], unknown, unknown] | undefined
        ): [MetricMeta[], unknown, unknown] | undefined => {
          if (!oldData) {
            return undefined;
          }
          const oldMeta = oldData[0];
          const index = oldMeta.findIndex((metric: {mri: MRI}) => metric.mri === mri);

          if (index !== undefined && index !== -1) {
            const newMeta = [...oldMeta];
            newMeta[index] = {...newMeta[index], ...data};

            return [newMeta, oldData[1], oldData[2]];
          }
          return oldData;
        }
      );

      addSuccessMessage(t('Metric updated'));
    },
    onError: () => {
      addErrorMessage(t('An error occurred while updating the metric'));
    },
  };

  return useMutation(options);
};
