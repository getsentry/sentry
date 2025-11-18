import type {TagCollection} from 'sentry/types/group';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

export const getHasTag = (tags: TagCollection) => ({
  key: FieldKey.HAS,
  name: 'Has property',
  values: Object.keys(tags).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }),
  predefined: true,
  kind: FieldKind.FIELD,
});
