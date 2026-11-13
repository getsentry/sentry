import {RuleTester} from 'oxlint/plugins-dev';

import {noStyledShortcut} from './noStyledShortcut';

const ruleTester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}});

ruleTester.run('no-styled-shortcut', noStyledShortcut, {
  valid: [
    {code: "var Test = styled('div')``;"},
    {code: 'var Test = other.div``;'},
    {code: 'var Test = styled[tag]``;'},
    {code: "var Test = styled['div']``;"},
    {code: 'class A { #div = 1; m(styled) { return styled.#div``; } }'},
  ],
  invalid: [
    {
      code: 'var Test = styled.div``;',
      output: "var Test = styled('div')``;",
      errors: [{messageId: 'noShorthand'}],
    },
    {
      code: `var Test = styled.div<Props>\`
  color: red;
\`;`,
      output: `var Test = styled('div')<Props>\`
  color: red;
\`;`,
      errors: [
        {messageId: 'noShorthand', line: 1, column: 11, endLine: 1, endColumn: 21},
      ],
    },
  ],
});
