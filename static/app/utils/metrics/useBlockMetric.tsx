import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {MetricMeta, MRI, Project} from 'sentry/types';
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
      return api.requestPromise(
        `/organizations/${slug}/${project.slug}/metrics/visibility/`,
        {
          method: 'PUT',
          query: {project: project.id},
          data: {metric_mri: mri, project, data},
        }
      );
    },
    onSuccess: data => {
      queryClient.setQueryData(
        [`/organizations/${slug}/metrics/meta/`, {query: {useCase, project: project.id}}],
        (oldData: MetricMeta[] | undefined): MetricMeta[] => {
          if (!oldData) {
            return [];
          }

          const index = oldData?.findIndex((metric: {mri: MRI}) => metric.mri === mri);

          if (index !== undefined && index !== -1) {
            return [
              ...oldData.slice(0, index),
              {...oldData[index], ...data},
              ...oldData.slice(index + 1),
            ];
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
