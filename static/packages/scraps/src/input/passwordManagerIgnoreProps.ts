/**
 * Spread onto inputs that never hold credentials (search boxes, filters) so
 * password manager extensions do not offer to fill them. There is no standard
 * attribute, so each manager needs its own.
 */
export const passwordManagerIgnoreProps = {
  'data-1p-ignore': true,
  'data-bwignore': true,
  'data-form-type': 'other',
  'data-lpignore': 'true',
  'data-protonpass-ignore': 'true',
} as const;
