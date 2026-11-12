/**
 * Stops password manager extensions from offering to fill an input. There is
 * no standard attribute, so each manager needs its own.
 */
export const passwordManagerIgnoreProps = {
  'data-1p-ignore': true,
  'data-bwignore': true,
  'data-form-type': 'other',
  'data-lpignore': 'true',
  'data-protonpass-ignore': 'true',
} as const;
