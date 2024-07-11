import omit from 'lodash/omit';

import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {
  ERROR_ONLY_FIELDS,
  FIELD_TAGS,
  SEMVER_TAGS,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRACING_FIELDS,
  TRANSACTION_ONLY_FIELDS,
} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';

export const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

export const STATIC_FIELD_TAGS_SET = new Set(Object.keys(FIELD_TAGS));

export const STATIC_FIELD_TAGS = Object.keys(FIELD_TAGS).reduce((tags, key) => {
  tags[key] = {
    ...FIELD_TAGS[key],
    kind: FieldKind.FIELD,
  };
  return tags;
}, {});

export const STATIC_FIELD_TAGS_WITHOUT_TRACING = omit(STATIC_FIELD_TAGS, TRACING_FIELDS);
export const STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS = omit(
  STATIC_FIELD_TAGS,
  ERROR_ONLY_FIELDS
);
export const STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS = omit(
  STATIC_FIELD_TAGS,
  TRANSACTION_ONLY_FIELDS
);

export const STATIC_SPAN_TAGS = SPAN_OP_BREAKDOWN_FIELDS.reduce((tags, key) => {
  tags[key] = {name: key, kind: FieldKind.METRICS};
  return tags;
}, {});

export const STATIC_SEMVER_TAGS = Object.keys(SEMVER_TAGS).reduce((tags, key) => {
  tags[key] = {
    ...SEMVER_TAGS[key],
    kind: FieldKind.FIELD,
  };
  return tags;
}, {});
