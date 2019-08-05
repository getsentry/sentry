/*eslint-env node*/
module.exports = {
  extends: [
    'stylelint-config-recommended',
    'stylelint-config-prettier',
    'stylelint-config-styled-components',
  ],
  rules: {
    'declaration-colon-newline-after': null,
    'block-no-empty': null,
    'selector-type-no-unknown': [true, {ignoreTypes: ['$dummyValue']}],
  },
};
