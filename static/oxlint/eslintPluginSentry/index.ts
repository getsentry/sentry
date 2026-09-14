import {
  emotionStyledImport,
  emotionSyntaxPreference,
  noVanillaEmotion,
} from './emotionRules.ts';
import {namingConvention} from './namingConvention.ts';
import {noCallingComponentsAsFunctions} from './noCallingComponentsAsFunctions.ts';
import {noDefaultExports} from './noDefaultExports.ts';
import {noDigitsInTn} from './noDigitsInTn.ts';
import {noDynamicTranslations} from './noDynamicTranslations.ts';
import {noFlagComments} from './noFlagComments.ts';
import {noQueryDataTypeParameters} from './noQueryDataTypeParameters.ts';
import {noRawCssInStyled} from './noRawCssInStyled.ts';
import {noRedundantDefaultArgument} from './noRedundantDefaultArgument.ts';
import {noRelativeImportPaths} from './noRelativeImportPaths.ts';
import {noStaticTranslations} from './noStaticTranslations.ts';
import {noStyledShortcut} from './noStyledShortcut.ts';
import {noUnnecessaryUseCallback} from './noUnnecessaryUseCallback.ts';
import {noUselessCssInterpolationSemicolon} from './noUselessCssInterpolationSemicolon.ts';
import {sortInterfaceKeys} from './sortInterfaceKeys.ts';

export const rules = {
  'emotion-styled-import': emotionStyledImport,
  'emotion-syntax-preference': emotionSyntaxPreference,
  'naming-convention': namingConvention,
  'no-calling-components-as-functions': noCallingComponentsAsFunctions,
  'no-default-exports': noDefaultExports,
  'no-digits-in-tn': noDigitsInTn,
  'no-dynamic-translations': noDynamicTranslations,
  'no-flag-comments': noFlagComments,
  'no-query-data-type-parameters': noQueryDataTypeParameters,
  'no-raw-css-in-styled': noRawCssInStyled,
  'no-redundant-default-argument': noRedundantDefaultArgument,
  'no-relative-import-paths': noRelativeImportPaths,
  'no-static-translations': noStaticTranslations,
  'no-styled-shortcut': noStyledShortcut,
  'no-useless-css-interpolation-semicolon': noUselessCssInterpolationSemicolon,
  'no-unnecessary-use-callback': noUnnecessaryUseCallback,
  'no-vanilla-emotion': noVanillaEmotion,
  'sort-interface-keys': sortInterfaceKeys,
};

const sentryPlugin = {
  meta: {
    name: '@sentry-internal/eslint-plugin-sentry',
    version: '1.0.0',
  },
  rules,
};

export default sentryPlugin;
