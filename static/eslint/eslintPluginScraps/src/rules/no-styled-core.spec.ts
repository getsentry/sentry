import {RuleTester} from '@typescript-eslint/rule-tester';

import {noStyledCore} from './no-styled-core';

const ruleTester = new RuleTester();

ruleTester.run('no-styled-core', noStyledCore, {
  valid: [
    {
      name: 'styled HTML element is allowed',
      code: `
        import styled from '@emotion/styled';
        const Wrapper = styled('div')\`color: red;\`;
      `,
    },
    {
      name: 'styled.element shorthand is allowed',
      code: `
        import styled from '@emotion/styled';
        const Wrapper = styled.div\`color: red;\`;
      `,
    },
    {
      name: 'styled with non-scraps component is allowed',
      code: `
        import styled from '@emotion/styled';
        import {SomeComponent} from 'other-lib';
        const Wrapper = styled(SomeComponent)\`color: red;\`;
      `,
    },
    {
      name: 'styled with local component is allowed',
      code: `
        import styled from '@emotion/styled';
        function MyComponent() { return null; }
        const Wrapper = styled(MyComponent)\`color: red;\`;
      `,
    },
    {
      name: 'components option filters enforcement',
      code: `
        import styled from '@emotion/styled';
        import {Button} from '@sentry/scraps/button';
        const StyledButton = styled(Button)\`color: red;\`;
      `,
      options: [{components: ['Flex']}],
    },
  ],
  invalid: [
    {
      name: 'styled(Component)`` with scraps import',
      code: `
        import styled from '@emotion/styled';
        import {Button} from '@sentry/scraps/button';
        const StyledButton = styled(Button)\`color: red;\`;
      `,
      errors: [
        {
          messageId: 'forbidden',
          data: {name: 'Button', source: '@sentry/scraps/button'},
        },
      ],
    },
    {
      name: 'styled(Component)({}) object syntax',
      code: `
        import styled from '@emotion/styled';
        import {Flex} from '@sentry/scraps/layout';
        const StyledFlex = styled(Flex)({display: 'block'});
      `,
      errors: [
        {
          messageId: 'forbidden',
          data: {name: 'Flex', source: '@sentry/scraps/layout'},
        },
      ],
    },
    {
      name: 'aliased import is still caught',
      code: `
        import styled from '@emotion/styled';
        import {Button as Btn} from '@sentry/scraps/button';
        const StyledBtn = styled(Btn)\`color: red;\`;
      `,
      errors: [
        {
          messageId: 'forbidden',
          data: {name: 'Btn', source: '@sentry/scraps/button'},
        },
      ],
    },
    {
      name: 'components option matches listed component',
      code: `
        import styled from '@emotion/styled';
        import {Button} from '@sentry/scraps/button';
        const StyledButton = styled(Button)\`color: red;\`;
      `,
      options: [{components: ['Button']}],
      errors: [
        {
          messageId: 'forbidden',
          data: {name: 'Button', source: '@sentry/scraps/button'},
        },
      ],
    },
    {
      name: 'multiple scraps components in one file',
      code: `
        import styled from '@emotion/styled';
        import {Text} from '@sentry/scraps/text';
        import {Container} from '@sentry/scraps/layout';
        const StyledText = styled(Text)\`color: red;\`;
        const StyledContainer = styled(Container)\`padding: 8px;\`;
      `,
      errors: [
        {
          messageId: 'forbidden',
          data: {name: 'Text', source: '@sentry/scraps/text'},
        },
        {
          messageId: 'forbidden',
          data: {name: 'Container', source: '@sentry/scraps/layout'},
        },
      ],
    },
  ],
});
