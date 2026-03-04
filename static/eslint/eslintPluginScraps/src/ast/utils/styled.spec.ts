import {AST_NODE_TYPES} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';

import {getStyledInfo} from './styled';

/**
 * Helpers to build minimal AST nodes for testing.
 */
function id(name: string): TSESTree.Identifier {
  return {type: AST_NODE_TYPES.Identifier, name} as TSESTree.Identifier;
}

function literal(value: string): TSESTree.StringLiteral {
  return {type: AST_NODE_TYPES.Literal, value} as TSESTree.StringLiteral;
}

function member(
  object: TSESTree.Expression,
  property: TSESTree.Expression
): TSESTree.MemberExpression {
  return {
    type: AST_NODE_TYPES.MemberExpression,
    object,
    property,
    computed: false,
  } as TSESTree.MemberExpression;
}

function call(
  callee: TSESTree.Expression,
  args: TSESTree.CallExpressionArgument[] = []
): TSESTree.CallExpression {
  return {
    type: AST_NODE_TYPES.CallExpression,
    callee,
    arguments: args,
  } as TSESTree.CallExpression;
}

describe('getStyledInfo', () => {
  it('css`...` → css', () => {
    expect(getStyledInfo(id('css'))).toEqual({kind: 'css'});
  });

  it('styled.div`...` → element', () => {
    expect(getStyledInfo(member(id('styled'), id('div')))).toEqual({
      kind: 'element',
      name: 'div',
    });
  });

  it('styled.span`...` → element', () => {
    expect(getStyledInfo(member(id('styled'), id('span')))).toEqual({
      kind: 'element',
      name: 'span',
    });
  });

  it('X.css`...` → css', () => {
    expect(getStyledInfo(member(id('SomeComponent'), id('css')))).toEqual({
      kind: 'css',
    });
  });

  it("styled('div')`...` → element", () => {
    expect(getStyledInfo(call(id('styled'), [literal('div')]))).toEqual({
      kind: 'element',
      name: 'div',
    });
  });

  it('styled(Button)`...` → component', () => {
    expect(getStyledInfo(call(id('styled'), [id('Button')]))).toEqual({
      kind: 'component',
      name: 'Button',
    });
  });

  it('styled(lowercaseVar)`...` → element', () => {
    expect(getStyledInfo(call(id('styled'), [id('myElement')]))).toEqual({
      kind: 'element',
      name: 'myElement',
    });
  });

  it('styled(Mod.Sub)`...` → component', () => {
    const arg = member(id('SimpleTable'), id('Header'));
    expect(getStyledInfo(call(id('styled'), [arg]))).toEqual({
      kind: 'component',
      name: 'SimpleTable.Header',
    });
  });

  it('styled(Component).attrs(...)`...` → component', () => {
    const styledCall = call(id('styled'), [id('Button')]);
    const attrsCall = call(member(styledCall, id('attrs')), []);
    expect(getStyledInfo(attrsCall)).toEqual({
      kind: 'component',
      name: 'Button',
    });
  });

  it('styled() with no args → null', () => {
    expect(getStyledInfo(call(id('styled')))).toBeNull();
  });

  it('random identifier → null', () => {
    expect(getStyledInfo(id('someFunction'))).toBeNull();
  });

  it('bare styled identifier → null', () => {
    expect(getStyledInfo(id('styled'))).toBeNull();
  });

  it('non-styled member expression → null', () => {
    expect(getStyledInfo(member(id('foo'), id('bar')))).toBeNull();
  });
});
