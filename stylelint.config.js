/* eslint-env node */
module.exports = {
  customSyntax: 'postcss-jsx',
  extends: ['stylelint-config-recommended', 'stylelint-config-prettier'],
  rules: {
    'declaration-colon-newline-after': null,

    // This is formatting related
    'declaration-bang-space-before': null,

    // Doesn't work when we use values from theme
    'unit-no-unknown': null,
    'font-family-no-missing-generic-family-keyword': null,
    'media-feature-name-no-unknown': null,

    // Does not seem useful
    'no-descending-specificity': null,

    // Breaks with interpolated template values
    'function-no-unknown': null,

    'property-no-unknown': [
      true,
      {
        // originX, orginY are used with framer motion
        ignoreProperties: ['origin-x', 'origin-y'],
      },
    ],

    // Allow empty template eg - styled(thing)``
    'no-empty-source': null,

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
