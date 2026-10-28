import {useEffect, useState} from 'react';
import omit from 'lodash/omit';
import {observe} from 'mobx';
import {parseAsJson, useQueryState} from 'nuqs';
import {z} from 'zod';

import type {FormModel} from 'sentry/components/forms/model';
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

export function DetectorDraftUrlSync<TFormData>({
  formModel,
  schema,
}: {
  formModel: FormModel;
  schema: DetectorDraftSchema<TFormData>;
}) {
  const {hasSetDetectorName} = useDetectorFormContext();
  const [, setDraft] = useQueryState(
    'draft',
    parseAsDetectorDraft.withOptions({history: 'replace'})
  );
  const [changeCount, setChangeCount] = useState(0);

  useEffect(
    () => observe(formModel.fields, () => setChangeCount(count => count + 1)),
    [formModel]
  );

  useEffect(() => {
    if (changeCount === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      const values = schema.parse(formModel.getData());
      setDraft(hasSetDetectorName ? values : omit(values, 'name'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [changeCount, formModel, hasSetDetectorName, schema, setDraft]);

  return null;
}
