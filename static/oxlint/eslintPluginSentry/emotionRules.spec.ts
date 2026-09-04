import {RuleTester} from '@typescript-eslint/rule-tester';

import {
  emotionStyledImport,
  emotionSyntaxPreference,
  noVanillaEmotion,
} from './emotionRules';

const ruleTester = new RuleTester();

ruleTester.run('no-vanilla-emotion', noVanillaEmotion, {
  valid: ["import {css} from '@emotion/react';"],
  invalid: [
    {
      code: "import {css} from '@emotion/css';",
      errors: [{messageId: 'vanillaEmotion'}],
    },
  ],
});

ruleTester.run('emotion-styled-import', emotionStyledImport, {
  valid: ["import styled from '@emotion/styled';"],
  invalid: [
    {
      code: "import styled from 'react-emotion';",
      errors: [{messageId: 'incorrectImport'}],
      output: "import styled from '@emotion/styled';",
    },
  ],
});

ruleTester.run('emotion-syntax-preference', emotionSyntaxPreference, {
  valid: [
    {code: 'const Component = styled.div`color: red;`;', options: ['string']},
    {code: 'const value = css`color: red;`;', options: ['string']},
  ],
  invalid: [
    {
      code: "const Component = styled('div')({color: 'red'});",
      options: ['string'],
      errors: [{messageId: 'preferStringStyle'}],
    },
    {
      code: "const value = css('color: red;');",
      options: ['string'],
      errors: [{messageId: 'preferWrappingWithCSS'}],
    },
  ],
});
