import {noCallingComponentsAsFunctions} from './no-calling-components-as-functions';
import {noDefaultExports} from './no-default-exports';
import {noDigitsInTn} from './no-digits-in-tn';
import {noDynamicTranslations} from './no-dynamic-translations';
import {noFlagComments} from './no-flag-comments';
import {noQueryDataTypeParameters} from './no-query-data-type-parameters';
import {noRawCssInStyled} from './no-raw-css-in-styled';
import {noStaticTranslations} from './no-static-translations';
import {noStyledShortcut} from './no-styled-shortcut';
import {noUnnecessaryTypeAnnotation} from './no-unnecessary-type-annotation';
import {noUnnecessaryTypeNarrowing} from './no-unnecessary-type-narrowing';
import {noUnnecessaryUseCallback} from './no-unnecessary-use-callback';
import {noUselessCssInterpolationSemicolon} from './no-useless-css-interpolation-semicolon';

export const rules = {
  'no-calling-components-as-functions': noCallingComponentsAsFunctions,
  'no-default-exports': noDefaultExports,
  'no-digits-in-tn': noDigitsInTn,
  'no-dynamic-translations': noDynamicTranslations,
  'no-flag-comments': noFlagComments,
  'no-query-data-type-parameters': noQueryDataTypeParameters,
  'no-raw-css-in-styled': noRawCssInStyled,
  'no-static-translations': noStaticTranslations,
  'no-styled-shortcut': noStyledShortcut,
  'no-useless-css-interpolation-semicolon': noUselessCssInterpolationSemicolon,
  'no-unnecessary-type-annotation': noUnnecessaryTypeAnnotation,
  'no-unnecessary-type-narrowing': noUnnecessaryTypeNarrowing,
  'no-unnecessary-use-callback': noUnnecessaryUseCallback,
};
