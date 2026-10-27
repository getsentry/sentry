import {useEffect, useRef, useState} from 'react';
import {reaction} from 'mobx';
import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import type {FormModel} from 'sentry/components/forms/model';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

const DETECTOR_DRAFT_VERSION = 1;

const detectorDraftSchema = z.object({
  version: z.literal(DETECTOR_DRAFT_VERSION),
  detectorType: z.string(),
  hasSetName: z.boolean(),
  values: z.record(z.string(), z.unknown()),
});

type DetectorDraft = z.infer<typeof detectorDraftSchema>;

const parseAsDetectorDraft = parseAsJson(detectorDraftSchema);

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

export interface DetectorDraftConfig<TFormData> {
  /**
   * Validators for the form fields stored in the URL draft. Fields left out
   * are never written to the URL.
   */
  shape: {[K in keyof TFormData]?: z.ZodType<TFormData[K]>};
  /**
   * Drops field combinations that are only valid together, since each field
   * is validated on its own.
   */
  normalize?: (values: Partial<TFormData>) => Partial<TFormData>;
}

/**
 * The draft as it was when the page loaded. Later draft writes bypass the
 * router, so they aren't visible here.
 */
export function useInitialDetectorDraft(detectorType: DetectorType | null) {
  const location = useLocation();
  const [draft] = useState(() => {
    const raw = decodeScalar(location.query.draft);
    const parsed = raw ? parseAsDetectorDraft.parse(raw) : null;
    return parsed?.detectorType === detectorType ? parsed : null;
  });
  return draft;
}

function getShapeKeys<TFormData>({shape}: DetectorDraftConfig<TFormData>) {
  return Object.keys(shape) as Array<keyof TFormData & string>;
}

/**
 * Validates each field on its own, so one stale or hand-edited field doesn't
 * discard the rest of a shared draft.
 */
export function parseDetectorDraftValues<TFormData>(
  config: DetectorDraftConfig<TFormData>,
  values: Record<string, unknown>
): Partial<TFormData> {
  const parsed: Partial<TFormData> = {};
  for (const key of getShapeKeys(config)) {
    if (!Object.hasOwn(values, key)) {
      continue;
    }
    const result = config.shape[key]?.safeParse(values[key]);
    if (result?.success) {
      parsed[key] = result.data;
    }
  }
  return config.normalize ? config.normalize(parsed) : parsed;
}

function pickDetectorDraftValues<TFormData>(
  config: DetectorDraftConfig<TFormData>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of getShapeKeys(config)) {
    if (data[key] !== undefined) {
      picked[key] = data[key];
    }
  }
  return picked;
}

// Links into monitor creation prefill through these. Once the draft is written
// it holds the same values, so these are removed to avoid conflicts.
const PREFILL_PARAMS = ['aggregate', 'dataset', 'environment', 'project', 'query'];

/**
 * Writes with the History API, like a shallow nuqs update, so the router
 * doesn't re-render the form on every edit. (nuqs's test adapter turns shallow
 * updates into router navigations, which made form tests flaky.) As with any
 * shallow update, useLocation() won't see the draft, so links on this page
 * shouldn't be built by spreading it.
 */
function replaceDraftInUrl(draft: DetectorDraft) {
  const url = new URL(window.location.href);
  for (const param of PREFILL_PARAMS) {
    url.searchParams.delete(param);
  }

  url.searchParams.set('draft', parseAsDetectorDraft.serialize(draft));
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Used once the monitor is created, so going back doesn't reopen the whole
 * draft.
 */
export function removeDetectorDraftFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('draft')) {
    return;
  }
  url.searchParams.delete('draft');
  window.history.replaceState(window.history.state, '', url);
}

export function DetectorDraftUrlSync<TFormData>({
  detectorType,
  draftConfig,
  formModel,
}: {
  detectorType: DetectorType;
  draftConfig: DetectorDraftConfig<TFormData>;
  formModel: FormModel;
}) {
  const {hasSetDetectorName} = useDetectorFormContext();
  const hasSetNameRef = useRef(hasSetDetectorName);
  useEffect(() => {
    hasSetNameRef.current = hasSetDetectorName;
  }, [hasSetDetectorName]);

  useEffect(() => {
    const {pathname} = window.location;
    // The delay batches keystrokes, and lets a name edit's hasSetDetectorName
    // update land before the draft reads it.
    return reaction(
      () => formModel.getData(),
      data => {
        // Submitting navigates away; don't let a pending write follow it.
        if (window.location.pathname !== pathname) {
          return;
        }
        replaceDraftInUrl({
          version: DETECTOR_DRAFT_VERSION,
          detectorType,
          hasSetName: hasSetNameRef.current,
          values: pickDetectorDraftValues(draftConfig, data),
        });
      },
      {delay: 300}
    );
  }, [detectorType, draftConfig, formModel]);

  return null;
}
