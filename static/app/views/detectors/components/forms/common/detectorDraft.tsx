import {useState} from 'react';
import {useDebouncedCallback} from '@tanstack/react-pacer';
import omit from 'lodash/omit';
import {parseAsJson, useQueryState} from 'nuqs';
import {z} from 'zod';

import type {FormModel} from 'sentry/components/forms/model';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

export type DetectorDraftSchema<TFormData> = z.ZodType<Partial<TFormData>>;

export function draftField<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

export const draftNumericString = z
  .string()
  .refine(value => value === '' || Number.isFinite(Number(value)));

// Number inputs hold strings once edited, so accept those too.
export const draftNumber = z.union([
  z.number(),
  z
    .string()
    .refine(value => value !== '' && Number.isFinite(Number(value)))
    .transform(Number),
]);

// A cleared optional number input holds ''.
export const draftOptionalNumber = z.union([
  draftNumber,
  z.null(),
  z.literal('').transform(() => null),
]);

const parseAsDetectorDraft = parseAsJson(z.record(z.string(), z.unknown()));

export function useInitialDetectorDraft() {
  const [draft] = useQueryState('draft', parseAsDetectorDraft);
  const [initialDraft] = useState(draft);
  return initialDraft;
}

export function useDetectorDraft<TFormData>(
  formModel: FormModel,
  schema: DetectorDraftSchema<TFormData> | undefined
) {
  const {getHasSetDetectorName} = useDetectorFormContext();
  const [draft, setDraft] = useQueryState('draft', parseAsDetectorDraft);
  const [initialValues] = useState(() =>
    draft && schema ? schema.parse(draft) : undefined
  );

  const writeDraft = useDebouncedCallback(
    (draftSchema: DetectorDraftSchema<TFormData>) => {
      const values = draftSchema.parse(formModel.getData());
      setDraft(getHasSetDetectorName() ? values : omit(values, 'name'));
    },
    {wait: DEFAULT_DEBOUNCE_DURATION}
  );

  const isMountedRef = useIsMountedRef();

  return {
    initialValues,
    onFieldChange: (id: string) => {
      if (schema && isMountedRef.current && (id !== 'name' || getHasSetDetectorName())) {
        writeDraft(schema);
      }
    },
  };
}
