import {parseAsString, useQueryState} from 'nuqs';
import {z} from 'zod';

import {defaultFormValidators, useScrapsForm} from '@sentry/scraps/form';
import {toast} from '@sentry/scraps/toast';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ClassifierDataset, PrebuiltClassifier} from 'sentry/views/classifiers/types';
import {getClassifierDetailPath} from 'sentry/views/classifiers/utils';

import {useCreateClassifier} from './useCreateClassifier';
import {usePrebuiltClassifiers} from './usePrebuiltClassifiers';

const classifierDetailsSchema = z.object({
  name: z.string().trim().min(1, t('Classifier title is required')).max(256),
  resultAttribute: z.string().trim().min(1, t('Attribute name is required')).max(256),
});

interface UseClassifierFormOptions {
  dataset: ClassifierDataset;
  filterQuery: string;
}

export function useClassifierForm({dataset, filterQuery}: UseClassifierFormOptions) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const [prebuiltKey, setPrebuiltKey] = useQueryState(
    'prebuilt',
    parseAsString.withOptions({history: 'replace'})
  );
  const {data: prebuiltClassifiers} = usePrebuiltClassifiers(dataset);
  const prebuilt = prebuiltClassifiers?.find(({key}) => key === prebuiltKey) ?? null;
  const createClassifier = useCreateClassifier();

  const form = useScrapsForm({
    defaultValues: {
      name: prebuilt?.name ?? '',
      resultAttribute: prebuilt?.resultAttribute ?? '',
    },
    validators: defaultFormValidators(classifierDetailsSchema),
    onSubmit: async ({value, createValidationError}) => {
      const project = selection.projects[0];
      if (!prebuilt || project === undefined) {
        return;
      }

      try {
        const classifier = await createClassifier.mutateAsync({
          ...classifierDetailsSchema.parse(value),
          dataset,
          filterQuery,
          prebuiltClassifierKey: prebuilt.key,
          project,
        });
        toast.success(t('Classifier created'));
        navigate(getClassifierDetailPath(organization.slug, classifier.id));
      } catch (error) {
        if (error instanceof RequestError) {
          const fields = requestErrorToFieldErrors(error, value);
          if (fields) {
            return createValidationError({fields});
          }
        }
        toast.error(t('Failed to create classifier'));
      }
      return;
    },
  });

  const selectPrebuilt = (nextPrebuilt: PrebuiltClassifier) => {
    setPrebuiltKey(nextPrebuilt.key);
    form.setFieldValue('name', nextPrebuilt.name);
    form.setFieldValue('resultAttribute', nextPrebuilt.resultAttribute);
  };

  return {form, prebuilt, selectPrebuilt};
}
