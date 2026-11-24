import type {ComposerValue} from '@sentry/scraps/composer';

import {localStorageWrapper} from 'sentry/utils/localStorage';

const STORAGE_KEY = 'investigation-comment-drafts';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Drafts = Record<
  string,
  {savedAt: number; text: string; mentions?: ComposerValue['mentions']}
>;

function draftKey(investigationId: string, blockId: string) {
  return `${investigationId}:${blockId}`;
}

function readDrafts(): Drafts {
  try {
    const drafts = JSON.parse(localStorageWrapper.getItem(STORAGE_KEY) ?? '{}') as Drafts;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(drafts).filter(([, draft]) => now - draft.savedAt < DRAFT_TTL_MS)
    );
  } catch {
    return {};
  }
}

export function loadCommentDraft(
  investigationId: string,
  blockId: string
): ComposerValue {
  const draft = readDrafts()[draftKey(investigationId, blockId)];
  return {text: draft?.text ?? '', mentions: draft?.mentions ?? []};
}

export function saveCommentDraft(
  investigationId: string,
  blockId: string,
  value: ComposerValue
) {
  const key = draftKey(investigationId, blockId);
  const {[key]: _previous, ...drafts} = readDrafts();
  if (value.text.trim()) {
    drafts[key] = {...value, savedAt: Date.now()};
  }
  try {
    if (Object.keys(drafts).length) {
      localStorageWrapper.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } else {
      localStorageWrapper.removeItem(STORAGE_KEY);
    }
  } catch {
    // Drafts are best-effort.
  }
}
