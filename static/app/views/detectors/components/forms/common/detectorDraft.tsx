import {useEffect, useState} from 'react';
import omit from 'lodash/omit';
import {observe} from 'mobx';
import {parseAsJson, useQueryState} from 'nuqs';
import {z} from 'zod';

import type {FormModel} from 'sentry/components/forms/model';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

/**
 * Each field should `.catch(undefined)` so one stale or hand-edited field
 * doesn't discard the rest of a shared draft.
 */
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
    // Each write is a navigation, so wait for a pause in typing.
    const timeout = setTimeout(() => {
      const values = schema.parse(formModel.getData());
      // Leave out automatic names so they keep updating for the draft's recipient.
      setDraft(hasSetDetectorName ? values : omit(values, 'name'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [changeCount, formModel, hasSetDetectorName, schema, setDraft]);

  return null;
}
