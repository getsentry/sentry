import {RuleTester} from 'oxlint/plugins-dev';

import {
  emotionStyledImport,
  emotionSyntaxPreference,
  noVanillaEmotion,
} from './emotionRules';

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});

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
    {
      code: "import {css} from 'react-emotion';",
      errors: [{messageId: 'incorrectImport'}],
      output: null,
    },
    {
      code: "import styled, {css} from 'react-emotion';",
      errors: [{messageId: 'incorrectImport'}],
      output: null,
    },
  ],
});

ruleTester.run('emotion-syntax-preference', emotionSyntaxPreference, {
  valid: [
    {code: 'const Component = styled.div`color: red;`;', options: ['string']},
    {code: 'const value = css`color: red;`;', options: ['string']},
    {
      code: 'const value = css(`color: red;`, ...styles, 1, null, [`color: red;`]);',
      options: ['string'],
    },
    {code: "const value = other({color: 'red'});", options: ['string']},
    {code: "const value = other.div({color: 'red'});", options: ['string']},
    {code: "const value = other('div')({color: 'red'});", options: ['string']},
    {code: "const value = css.div({color: 'red'});", options: ['string']},
    {code: 'const element = <div css={css`color: red;`} />;', options: ['string']},
    {code: 'const element = <div css={`color: red;`} />;', options: ['string']},
    {code: "const element = <div style={{color: 'red'}} />;", options: ['string']},
    {code: "const Component = styled('div')({color: 'red'});", options: ['object']},
    {code: "const value = css({color: 'red'}, [{color: 'blue'}]);", options: ['object']},
    {code: 'const value = other`color: red;`;', options: ['object']},
    {code: 'const value = other.div`color: red;`;', options: ['object']},
    {code: "const value = other('div')`color: red;`;", options: ['object']},
    {code: "const element = <div css={{color: 'red'}} />;", options: ['object']},
    {code: "const element = <div css={[{color: 'red'}, 1]} />;", options: ['object']},
    {code: "const Component = styled('div')({color: 'red'});"},
    {code: 'const Component = styled.div`color: red;`;'},
    {code: 'const element = <div css="color: red;" />;'},
  ],
  invalid: [
    {
      code: "const Component = styled('div')({color: 'red'});",
      options: ['string'],
      errors: [{messageId: 'preferStringStyle'}],
    },
    {
      code: "const Component = styled.div({color: 'red'});",
      options: ['string'],
      errors: [{messageId: 'preferStringStyle'}],
    },
    {
      code: "const value = css('color: red;');",
      options: ['string'],
      errors: [{messageId: 'preferWrappingWithCSS'}],
    },
    {
      code: "const value = css([{color: 'red'}, 'color: red;']);",
      options: ['string'],
      errors: [{messageId: 'preferStringStyle'}, {messageId: 'preferWrappingWithCSS'}],
    },
    {
      code: "const element = <div css={{color: 'red'}} />;",
      options: ['string'],
      errors: [{messageId: 'preferStringStyle'}],
    },
    {
      code: 'const element = <div css="color: red;" />;',
      options: ['string'],
      errors: [{messageId: 'preferWrappingWithCSS'}],
    },
    {
      code: 'const element = <div css />;',
      options: ['string'],
      errors: [{messageId: 'emptyCssProp'}],
    },
    {
      code: 'const element = <div css />;',
      errors: [{messageId: 'emptyCssProp'}],
    },
    {
      code: 'const Component = styled.div`color: red;`;',
      options: ['object'],
      errors: [{messageId: 'preferObjectStyle'}],
    },
    {
      code: "const Component = styled('div')`color: red;`;",
      options: ['object'],
      errors: [{messageId: 'preferObjectStyle'}],
    },
    {
      code: 'const value = css`color: red;`;',
      options: ['object'],
      errors: [{messageId: 'preferObjectStyle'}],
    },
    {
      code: "const value = css(`color: red;`, 'color: blue;', [`color: green;`]);",
      options: ['object'],
      errors: [
        {messageId: 'preferObjectStyle'},
        {messageId: 'preferObjectStyle'},
        {messageId: 'preferObjectStyle'},
      ],
    },
    {
      code: 'const element = <div css={`color: red;`} />;',
      options: ['object'],
      errors: [{messageId: 'preferObjectStyle'}],
    },
    {
      code: 'const element = <div css="color: red;" />;',
      options: ['object'],
      errors: [{messageId: 'preferObjectStyle'}],
    },
  ],
});
