import {RuleTester} from 'oxlint/plugins-dev';

import {noStyledShortcut} from './noStyledShortcut';

const ruleTester = new RuleTester();

ruleTester.run('no-styled-shortcut', noStyledShortcut, {
  valid: [{code: "var Test = styled('div')``;"}],
  invalid: [
    {
      code: 'var Test = styled.div``;',
      output: "var Test = styled('div')``;",
      errors: [{messageId: 'noShorthand'}],
    },
  ],
});
