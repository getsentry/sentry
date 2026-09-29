import type {ESTree} from '@oxlint/plugins';
import {RuleTester} from 'oxlint/plugins-dev';

import {isJsxOrNullExpression, preferReactComponent} from './preferReactComponent';

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

describe('isJsxOrNullExpression', () => {
  function parenthesize(expression: ESTree.Node): ESTree.Node {
    return {
      type: 'ParenthesizedExpression',
      expression,
    } as unknown as ESTree.Node;
  }

  it('unwraps a parenthesized JSX expression', () => {
    const jsxElement = {type: 'JSXElement'} as unknown as ESTree.Node;

    expect(isJsxOrNullExpression(parenthesize(jsxElement))).toBe(true);
  });

  it('unwraps a parenthesized null expression', () => {
    const nullLiteral = {type: 'Literal', value: null} as unknown as ESTree.Node;

    expect(isJsxOrNullExpression(parenthesize(nullLiteral))).toBe(true);
  });

  it('recognizes parenthesized branches of a conditional expression', () => {
    const jsxElement = {type: 'JSXElement'} as unknown as ESTree.Node;
    const nullLiteral = {type: 'Literal', value: null} as unknown as ESTree.Node;
    const conditional = {
      type: 'ConditionalExpression',
      test: {type: 'Identifier', name: 'condition'},
      consequent: parenthesize(jsxElement),
      alternate: parenthesize(nullLiteral),
    } as unknown as ESTree.Node;

    expect(isJsxOrNullExpression(conditional)).toBe(true);
  });
});
