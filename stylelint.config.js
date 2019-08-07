/*eslint-env node*/
module.exports = {
  extends: [
    'stylelint-config-recommended',
    'stylelint-config-styled-components',
    'stylelint-config-prettier',
  ],
  rules: {
    'declaration-colon-newline-after': null,
    'block-no-empty': null,

    // This is formatting related
    'declaration-bang-space-before': null,

    // Doesn't work when we use values from theme
    'unit-no-unknown': null,
    'font-family-no-missing-generic-family-keyword': null,
  },
};
