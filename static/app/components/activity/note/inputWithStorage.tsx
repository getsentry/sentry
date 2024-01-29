import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {NoteInput} from 'sentry/components/activity/note/input';
import type {MentionChangeEvent} from 'sentry/components/activity/note/types';
import type {NoteType} from 'sentry/types/alerts';
import localStorage from 'sentry/utils/localStorage';

type InputProps = React.ComponentProps<typeof NoteInput>;

type Props = {
  itemKey: string;
  storageKey: string;
  onLoad?: (data: string) => string;
  onSave?: (data: string) => string;
  text?: string;
} & InputProps;

function fetchFromStorage(storageKey: string) {
  const storage = localStorage.getItem(storageKey);
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
    localStorage.setItem(storageKey, JSON.stringify(obj));
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
  onCreate,
  onLoad,
  onSave,
  text,
  ...props
}: Props) {
  const value = useMemo(() => {
    if (text) {
      return text;
    }

    const storageObj = fetchFromStorage(storageKey);

    if (!storageObj) {
      return '';
    }

    if (!storageObj.hasOwnProperty(itemKey)) {
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

  /**
   * Handler when note is created.
   *
   * Remove in progress item from local storage if it exists
   */
  const handleCreate = useCallback(
    (data: NoteType) => {
      onCreate?.(data);

      // Remove from local storage
      const storageObj = fetchFromStorage(storageKey) ?? {};

      // Nothing from this `itemKey` is saved to storage, do nothing
      if (!storageObj.hasOwnProperty(itemKey)) {
        return;
      }

      // Remove `itemKey` from stored object and save to storage
      // eslint-disable-next-line no-unused-vars
      const {[itemKey]: _oldItem, ...newStorageObj} = storageObj;
      saveToStorage(storageKey, newStorageObj);
    },
    [itemKey, onCreate, storageKey]
  );

  // Make sure `this.props` does not override `onChange` and `onCreate`
  return (
    <NoteInput {...props} text={value} onCreate={handleCreate} onChange={handleChange} />
  );
}

export {NoteInputWithStorage};
