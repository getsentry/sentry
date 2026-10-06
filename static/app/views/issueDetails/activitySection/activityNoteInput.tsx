import {useMemo} from 'react';
import styled from '@emotion/styled';
import {useDebouncer} from '@tanstack/react-pacer';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import type {NoteType} from 'sentry/types/alerts';
import {localStorageWrapper} from 'sentry/utils/localStorage';

interface ActivityNoteInputProps {
  itemKey: string;
  onSubmit: (data: NoteType) => Promise<void>;
  storageKey: string;
  minHeight?: number;
  placeholder?: string;
  variant?: 'compact' | 'full';
}

type DraftStorage = Record<string, string>;

function fetchFromStorage(storageKey: string): DraftStorage | null {
  const storage = localStorageWrapper.getItem(storageKey);
  if (!storage) {
    return null;
  }

  try {
    return JSON.parse(storage) as DraftStorage;
  } catch {
    return null;
  }
}

function saveToStorage(storageKey: string, drafts: DraftStorage) {
  try {
    localStorageWrapper.setItem(storageKey, JSON.stringify(drafts));
  } catch {
    // Draft persistence is best-effort.
  }
}

export function ActivityNoteInput({
  itemKey,
  storageKey,
  variant,
  onSubmit,
  minHeight,
  placeholder,
}: ActivityNoteInputProps) {
  const value = useMemo(() => {
    const drafts = fetchFromStorage(storageKey);
    return drafts?.[itemKey] ?? '';
  }, [itemKey, storageKey]);

  const draftSave = useDebouncer(
    (newValue: string) => {
      const currentDrafts = fetchFromStorage(storageKey) ?? {};
      saveToStorage(storageKey, {...currentDrafts, [itemKey]: newValue});
    },
    {wait: 150}
  );

  async function handleSubmit(data: NoteType) {
    draftSave.cancel();
    await onSubmit(data);

    const drafts = fetchFromStorage(storageKey) ?? {};
    if (Object.hasOwn(drafts, itemKey)) {
      const {[itemKey]: _submittedDraft, ...remainingDrafts} = drafts;
      saveToStorage(storageKey, remainingDrafts);
    }
  }

  return (
    <ActivityInputFrame>
      <MentionComposer
        initialValue={value}
        minHeight={minHeight}
        mode="create"
        placeholder={placeholder}
        onSubmit={handleSubmit}
        onValueChange={draftSave.maybeExecute}
        variant={variant}
      />
    </ActivityInputFrame>
  );
}

export function ActivityInputFrame({children}: React.PropsWithChildren) {
  return <Frame data-test-id="activity-input-frame">{children}</Frame>;
}

const Frame = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  container-type: inline-size;
  min-width: 0;
`;
