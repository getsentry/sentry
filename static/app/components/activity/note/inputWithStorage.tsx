import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CompactNoteInput} from 'sentry/components/activity/note/compact';
import {NoteInput} from 'sentry/components/activity/note/input';
import type {MentionChangeEvent} from 'sentry/components/activity/note/types';
import {t, tct} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';

type InputProps = React.ComponentProps<typeof NoteInput>;

type Props = {
  group: Group;
  itemKey: string;
  storageKey: string;
  onCommentCreated?: (activity: GroupActivity[]) => void;
  onCommentEdited?: (activity: GroupActivity[]) => void;
  onLoad?: (data: string) => string;
  onSave?: (data: string) => string;
  text?: string;
  variant?: 'compact' | 'full';
} & Omit<InputProps, 'onCreate' | 'onUpdate'>;

function fetchFromStorage(storageKey: string) {
  const storage = localStorageWrapper.getItem(storageKey);
  if (!storage) {
    return null;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setExtra('storage', storage);
      Sentry.captureException(err);
    });
    return null;
  }
}

function saveToStorage(storageKey: string, obj: Record<string, any>) {
  try {
    localStorageWrapper.setItem(storageKey, JSON.stringify(obj));
  } catch (err) {
    Sentry.captureException(err);
    Sentry.withScope(scope => {
      scope.setExtra('storage', obj);
      Sentry.captureException(err);
    });
  }
}

function NoteInputWithStorage({
  itemKey,
  storageKey,
  onChange,
  onLoad,
  onSave,
  text,
  variant,
  group,
  onCommentCreated,
  onCommentEdited,
  noteId,
  ...props
}: Props) {
  const organization = useOrganization();
  const mutators = useMutateActivity({organization, group});

  const value = useMemo(() => {
    if (text) {
      return text;
    }

    const storageObj = fetchFromStorage(storageKey);

    if (!storageObj) {
      return '';
    }

    if (!Object.hasOwn(storageObj, itemKey)) {
      return '';
    }
    if (!onLoad) {
      return storageObj[itemKey];
    }

    return onLoad(storageObj[itemKey]);
  }, [itemKey, onLoad, storageKey, text]);

  const save = useMemo(
    () =>
      debounce((newValue: string) => {
        const currentObj = fetchFromStorage(storageKey) ?? {};

        const newObject = {
          ...currentObj,
          [itemKey]: onSave?.(newValue) ?? newValue,
        };

        saveToStorage(storageKey, newObject);
      }, 150),
    [itemKey, onSave, storageKey]
  );

  const handleChange = useCallback(
    (e: MentionChangeEvent, options: {updating?: boolean} = {}) => {
      onChange?.(e, options);

      if (options.updating) {
        return;
      }

      save(e.target.value);
    },
    [onChange, save]
  );

  const handleCreate = useCallback(
    async (data: NoteType) => {
      save.cancel();
      const result = await mutators.handleCreate(data, {
        onSuccess: () => {
          addSuccessMessage(t('Comment posted'));
        },
        onError: error => {
          const errMessage = error.responseJSON?.detail
            ? tct('Error: [msg]', {msg: error.responseJSON?.detail as string})
            : t('Unable to post comment');
          addErrorMessage(errMessage);
        },
      });

      // Clear the localStorage draft on success
      const storageObj = fetchFromStorage(storageKey) ?? {};
      if (Object.hasOwn(storageObj, itemKey)) {
        const {[itemKey]: _oldItem, ...newStorageObj} = storageObj;
        saveToStorage(storageKey, newStorageObj);
      }

      trackAnalytics('issue_details.comment_created', {organization});
      onCommentCreated?.([result, ...group.activity]);
    },
    [save, itemKey, storageKey, mutators, group.activity, organization, onCommentCreated]
  );

  const handleUpdate = useCallback(
    async (data: NoteType) => {
      if (!noteId) {
        return;
      }
      const result = await mutators.handleUpdate(data, noteId, {
        onSuccess: () => {
          addSuccessMessage(t('Comment updated'));
        },
        onError: () => {
          addErrorMessage(t('Unable to update comment'));
        },
      });

      trackAnalytics('issue_details.comment_updated', {organization});
      onCommentEdited?.(group.activity.map(a => (a.id === result.id ? result : a)));
    },
    [mutators, noteId, group.activity, organization, onCommentEdited]
  );

  if (variant === 'compact') {
    return (
      <CompactNoteInput
        text={value}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onChange={handleChange}
        placeholder={props.placeholder}
        noteId={noteId}
        onCancel={props.onCancel}
      />
    );
  }

  return (
    <NoteInput
      {...props}
      text={value}
      noteId={noteId}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onChange={handleChange}
    />
  );
}

export {NoteInputWithStorage};
