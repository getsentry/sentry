/* eslint-env node */
module.exports = {
  customSyntax: 'postcss-jsx',
  processors: ['stylelint-processor-styled-components'],
  extends: ['stylelint-config-recommended', 'stylelint-config-prettier'],
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

    'property-disallowed-list': [
      // Prefer `gap` over `grid-gap`, it does the same thing
      'grid-gap',
      // Can't set per-property custom messages.. so try and bring them here
      {
        message: 'Disallowed property. (See `stylelint.config.js` as to why)',
      },
    ],
  },
};
