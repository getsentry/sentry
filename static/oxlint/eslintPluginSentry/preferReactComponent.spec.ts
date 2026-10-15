import {RuleTester} from 'oxlint/plugins-dev';

import {preferReactComponent} from './preferReactComponent';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('prefer-react-component', preferReactComponent, {
  valid: [
    {
      name: 'logical AND returning data',
      code: 'function Component() { const getValue = () => condition && value; return <div>{getValue()}</div>; }',
    },
    {
      name: 'logical OR with an unknown left operand',
      code: 'function Component() { const getValue = () => value || <Heading />; return <div>{getValue()}</div>; }',
    },
    {
      name: 'array containing a non-JSX value',
      code: 'function Component() { const getValues = () => [<Heading />, value]; return <div>{getValues()}</div>; }',
    },
    {
      name: 'array with an unknown spread',
      code: 'function Component() { const getValues = () => [<Heading />, ...values]; return <div>{getValues()}</div>; }',
    },
    {
      name: 'empty array',
      code: 'function Component() { const getValues = () => []; return <div>{getValues()}</div>; }',
    },
    {
      name: 'JSX in a nested function does not make its parent a React scope',
      code: 'function buildValue() { function makeHeader() { return <Heading />; } return makeHeader(); }',
    },
    {
      name: 'JSX in a sibling function does not make the parent a React scope',
      code: 'function buildValue() { const Header = () => <Heading />; const getValue = () => null; return getValue(); }',
    },
    {
      name: 'nested JSX returns do not count as returns from their parent',
      code: 'function Component() { function getValue() { const Header = () => <Heading />; return value; } return <div>{getValue()}</div>; }',
    },
    {
      name: 'top-level function returning JSX',
      code: 'function Header() { return <Heading />; }',
    },
    {
      name: 'top-level arrow function returning JSX',
      code: 'const Header = () => <Heading />;',
    },
    {
      name: 'nested function returning data',
      code: 'function Component() { function getValue() { return value; } return <div />; }',
    },
    {
      name: 'nested function with a non-JSX return branch',
      code: 'function Component() { function getHeader() { if (condition) return <Heading />; return value; } return <div />; }',
    },
    {
      name: 'nested function in a non-React scope',
      code: 'function buildValue() { function makeHeader() { return <Heading />; } return makeHeader; }',
    },
    {
      name: 'class render method',
      code: 'class Component { render() { return <div />; } }',
    },
    {
      name: 'JSX-returning function passed as a prop',
      code: `
        function Component() {
          const renderHeader = () => <Heading />;
          return <Modal renderHeader={renderHeader} />;
        }
      `,
    },
  ],

  invalid: [
    {
      name: 'parent JSX appears after the helper in a lowercase function',
      code: 'function component() { const makeHeader = () => <Heading />; return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'parent JSX appears before the helper in a lowercase function',
      code: 'function component() { const body = <div />; const makeHeader = () => <Heading />; return [body, makeHeader()]; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'React scope is an ancestor beyond the immediate parent',
      code: 'function component() { function getValue() { const makeHeader = () => <Heading />; return {header: makeHeader()}; } return <div>{getValue().header}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'nested data returns do not exclude a JSX-returning helper',
      code: 'function Component() { function makeHeader() { function getValue() { return value; } return <Heading>{getValue()}</Heading>; } return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'null-returning helper inside a wrapped component',
      code: 'const Component = memo(() => { const makeHeader = () => null; return makeHeader(); });',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'concise arrow parent with JSX',
      code: 'const component = () => <div>{(() => { const makeHeader = () => <Heading />; return makeHeader(); })()}</div>;',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'logical AND returning JSX',
      code: 'function Component() { const makeHeader = () => condition && <Heading />; return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'array of JSX elements',
      code: 'function Component() { const makeHeaders = () => [<Heading key="first" />, <Heading key="second" />]; return <div>{makeHeaders()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeaders'}}],
    },
    {
      name: 'block body returning an array with conditional JSX and null',
      code: 'function Component() { function makeHeaders() { return [condition && <Heading />, null]; } return <div>{makeHeaders()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeaders'}}],
    },
    {
      name: 'function declaration returning JSX inside a component',
      code: "function Component() { function getModalHeader(title) { return <Heading>{title}</Heading>; } return <div>{getModalHeader('Title')}</div>; }",
      errors: [{messageId: 'useComponent', data: {name: 'getModalHeader'}}],
    },
    {
      name: 'function declaration with setup before JSX return',
      code: "function Component() { function makeHeader(title) { const heading = title.trim(); return <Heading>{heading}</Heading>; } return <div>{makeHeader('Title')}</div>; }",
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'arrow function returning JSX inside a component',
      code: "function Component() { const getHeader = title => <Heading>{title}</Heading>; return <div>{getHeader('Title')}</div>; }",
      errors: [{messageId: 'useComponent', data: {name: 'getHeader'}}],
    },
    {
      name: 'function expression returning JSX inside a component',
      code: 'function Component() { const renderHeader = function () { return <Heading />; }; return <div>{renderHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'renderHeader'}}],
    },
    {
      name: 'all return branches return JSX',
      code: 'function Component() { function makeHeader() { if (condition) return <Heading />; return <Fallback />; } return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'return branches contain JSX or null',
      code: 'function Component() { function makeHeader() { if (condition) return <Heading />; return null; } return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'parenthesized JSX return',
      code: 'function Component() { function makeHeader() { return (<Heading />); } return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'conditional JSX expression',
      code: 'function Component() { const makeHeader = () => (condition ? <Heading /> : <Fallback />); return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'parenthesized branches of a conditional expression',
      code: 'function Component() { const makeHeader = () => condition ? (<Heading />) : (null); return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'function inside a custom hook',
      code: 'function useComponentData() { const makeHeader = () => <Heading />; return {header: makeHeader()}; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
    {
      name: 'function inside a component with a non-helper name',
      code: 'function Component() { function makeHeader() { return <Heading />; } return <div>{makeHeader()}</div>; }',
      errors: [{messageId: 'useComponent', data: {name: 'makeHeader'}}],
    },
  ],
});
