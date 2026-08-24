import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import {t, tct} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';

type Props = {
  group: Group;
  itemKey: string;
  storageKey: string;
  minHeight?: number;
  onCommentCreated?: (activity: GroupActivity[]) => void;
  placeholder?: string;
  variant?: 'compact' | 'full';
};

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
  variant,
  group,
  onCommentCreated,
  minHeight,
  placeholder,
}: Props) {
  const organization = useOrganization();
  const mutators = useMutateActivity({organization, group});

  const value = useMemo(() => {
    const storageObj = fetchFromStorage(storageKey);

    if (!storageObj) {
      return '';
    }

    if (!Object.hasOwn(storageObj, itemKey)) {
      return '';
    }
    return storageObj[itemKey];
  }, [itemKey, storageKey]);

  const save = useMemo(
    () =>
      debounce((newValue: string) => {
        const currentObj = fetchFromStorage(storageKey) ?? {};

        const newObject = {
          ...currentObj,
          [itemKey]: newValue,
        };

        saveToStorage(storageKey, newObject);
      }, 150),
    [itemKey, storageKey]
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

  return (
    <MentionComposer
      initialValue={value}
      minHeight={minHeight}
      mode="create"
      placeholder={placeholder}
      onSubmit={handleCreate}
      onValueChange={save}
      variant={variant}
    />
  );
}

export {NoteInputWithStorage};
