import {noDefaultExports} from './no-default-exports';
import {noDigitsInTn} from './no-digits-in-tn';
import {noDynamicTranslations} from './no-dynamic-translations';
import {noFlagComments} from './no-flag-comments';
import {noStaticTranslations} from './no-static-translations';
import {noStyledShortcut} from './no-styled-shortcut';
import {noUnnecessaryTypeAnnotation} from './no-unnecessary-type-annotation';

export const rules = {
  'no-default-exports': noDefaultExports,
  'no-digits-in-tn': noDigitsInTn,
  'no-dynamic-translations': noDynamicTranslations,
  'no-flag-comments': noFlagComments,
  'no-static-translations': noStaticTranslations,
  'no-styled-shortcut': noStyledShortcut,
  'no-unnecessary-type-annotation': noUnnecessaryTypeAnnotation,
};
