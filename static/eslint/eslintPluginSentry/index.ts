import {noCallingComponentsAsFunctions} from './noCallingComponentsAsFunctions';
import {noDefaultExports} from './noDefaultExports';
import {noDigitsInTn} from './noDigitsInTn';
import {noDynamicTranslations} from './noDynamicTranslations';
import {noFlagComments} from './noFlagComments';
import {noQueryDataTypeParameters} from './noQueryDataTypeParameters';
import {noRawCssInStyled} from './noRawCssInStyled';
import {noStaticTranslations} from './noStaticTranslations';
import {noStyledShortcut} from './noStyledShortcut';
import {noUnnecessaryTypeAnnotation} from './noUnnecessaryTypeAnnotation';
import {noUnnecessaryTypeNarrowing} from './noUnnecessaryTypeNarrowing';
import {noUnnecessaryUseCallback} from './noUnnecessaryUseCallback';
import {noUselessCssInterpolationSemicolon} from './noUselessCssInterpolationSemicolon';

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
