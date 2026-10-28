import {useEffect, useState} from 'react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import {parseAsJson, useQueryState} from 'nuqs';
import {z} from 'zod';

import type {FormModel} from 'sentry/components/forms/model';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

export type DetectorDraftSchema<TFormData> = z.ZodType<Partial<TFormData>>;

export const draftNumericString = z
  .string()
  .refine(value => value === '' || Number.isFinite(Number(value)));

const parseAsDetectorDraft = parseAsJson(z.record(z.string(), z.unknown()));

export function useInitialDetectorDraft() {
  const [draft] = useQueryState('draft', parseAsDetectorDraft);
  const [initialDraft] = useState(draft);
  return initialDraft;
}

export function useDetectorDraftUrlSync<TFormData>(
  formModel: FormModel,
  schema: DetectorDraftSchema<TFormData> | undefined
) {
  const {getHasSetDetectorName} = useDetectorFormContext();
  const [, setDraft] = useQueryState('draft', parseAsDetectorDraft);

  const [writeDraft] = useState(() =>
    debounce(() => {
      if (!schema) {
        return;
      }
      const values = schema.parse(formModel.getData());
      setDraft(getHasSetDetectorName() ? values : omit(values, 'name'));
    }, DEFAULT_DEBOUNCE_DURATION)
  );

  useEffect(() => () => writeDraft.cancel(), [writeDraft]);

  return (id: string) => {
    if (id !== 'name' || getHasSetDetectorName()) {
      writeDraft();
    }
  };
}
