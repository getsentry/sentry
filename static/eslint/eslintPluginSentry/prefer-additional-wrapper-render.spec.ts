import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferAdditionalWrapperRender} from './prefer-additional-wrapper-render';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('prefer-additional-wrapper-render', preferAdditionalWrapperRender, {
  valid: [
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Component />);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Component />, {additionalWrapper: Wrapper});
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper foo="bar"><Component /></Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<div><Component /></div>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper><A /><B /></Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper />);
    `,
    `
      import {render} from '@testing-library/react';
      render(<Wrapper><Component /></Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      otherFunction(<Wrapper><Component /></Wrapper>);
    `,
    `
      render(<Wrapper><Component /></Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper>{getComponent()}</Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper>some text</Wrapper>);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper><Component /></Wrapper>, options);
    `,
    `
      import {render} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper />, {organization});
    `,
    `
      import {render as myRender} from 'sentry-test/reactTestingLibrary';
      render(<Wrapper><Component /></Wrapper>);
    `,
  ],
  invalid: [
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component /></Wrapper>);
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component />, {additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component /></Wrapper>, {organization});
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component />, {organization, additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component /></Wrapper>, {organization, initialRouterConfig});
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component />, {organization, initialRouterConfig, additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component prop="x" other={value} /></Wrapper>, {organization});
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component prop="x" other={value} />, {organization, additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component>text</Component></Wrapper>, {organization});
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component>text</Component>, {organization, additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(
          <Wrapper>
            <Component />
          </Wrapper>,
          {organization}
        );
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(
          <Component />,
          {organization, additionalWrapper: Wrapper}
        );
      `,
    },
    {
      code: `
        import {render as myRender} from 'sentry-test/reactTestingLibrary';
        myRender(<Wrapper><Component /></Wrapper>);
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render as myRender} from 'sentry-test/reactTestingLibrary';
        myRender(<Component />, {additionalWrapper: Wrapper});
      `,
    },
    {
      code: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Wrapper><Component /></Wrapper>, {});
      `,
      errors: [{messageId: 'useAdditionalWrapper'}],
      output: `
        import {render} from 'sentry-test/reactTestingLibrary';
        render(<Component />, {additionalWrapper: Wrapper});
      `,
    },
  ],
});
