/*eslint-env node*/
module.exports = {
  processors: ['stylelint-processor-styled-components'],
  extends: [
    'stylelint-config-recommended',
    'stylelint-config-styled-components',
    'stylelint-config-prettier',
  ],
  rules: {
    'declaration-colon-newline-after': null,

    // This is formatting related
    'declaration-bang-space-before': null,

    // Doesn't work when we use values from theme
    'unit-no-unknown': null,
    'font-family-no-missing-generic-family-keyword': null,

    // Does not seem useful
    'no-descending-specificity': null,

    'property-no-unknown': [true, {ignoreProperties: [/\$dummyValue/]}],
  },
};
