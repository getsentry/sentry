import {defineRule, type ESTree} from '@oxlint/plugins';

import {parseCssTemplate} from '../ast/extractor/css.ts';
import {createImportTracker} from '../ast/tracker/imports.ts';
import {getStyledCallInfo} from '../ast/utils/styled.ts';

const LAYOUT_SOURCE = '@sentry/scraps/layout';
const PANEL_HEADER_SOURCE = 'sentry/components/panels/panelHeader';
const TABLE_ELEMENTS = new Set(['table', 'tr', 'th']);
const ITERATING_METHODS = new Set(['map', 'flatMap']);
const MINIMUM_SHARED_TRACKS = 3;

const GRID_MIXIN_NAME = /grid|column|layout|template/i;

interface TemplateUse {
  node: ESTree.Node;
  repeated: boolean;
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countTracks(template: string): number {
  let tracks = 0;
  for (const track of normalizeSpace(template).match(
    /[\w-]+\([^()]*(?:\([^()]*\))*[^()]*\)|\S+/g
  ) ?? []) {
    const repeat = /^repeat\(\s*(\d+)\s*,/.exec(track);
    tracks += repeat ? Number(repeat[1]) : 1;
  }
  return tracks;
}

function staticString(node: ESTree.Node | null | undefined): string | null {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

function belowMinimumTracks(node: ESTree.Node | null): boolean {
  const literal = staticString(node);
  if (literal !== null) {
    return countTracks(literal) < MINIMUM_SHARED_TRACKS;
  }
  return (
    node?.type === 'ObjectExpression' &&
    node.properties.every(
      property => property.type === 'Property' && belowMinimumTracks(property.value)
    )
  );
}

function attribute(
  node: ESTree.JSXOpeningElement,
  name: string
): ESTree.JSXAttribute | undefined {
  return node.attributes.find(
    (item): item is ESTree.JSXAttribute =>
      item.type === 'JSXAttribute' &&
      item.name.type === 'JSXIdentifier' &&
      item.name.name === name
  );
}

function attributeExpression(item: ESTree.JSXAttribute | undefined): ESTree.Node | null {
  if (!item?.value) {
    return null;
  }
  return item.value.type === 'JSXExpressionContainer'
    ? item.value.expression
    : item.value;
}

function isIterated(node: ESTree.Node): boolean {
  for (let current: ESTree.Node | null = node; current; current = current.parent) {
    const parent: ESTree.Node | null = current.parent;
    if (
      parent?.type === 'CallExpression' &&
      parent.arguments.some(argument => argument === current) &&
      parent.callee.type === 'MemberExpression' &&
      parent.callee.property.type === 'Identifier' &&
      ITERATING_METHODS.has(parent.callee.property.name)
    ) {
      return true;
    }
  }
  return false;
}

export const noManualTable = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow tables built by hand instead of with SimpleTable.',
    },
    schema: [],
    messages: {
      tableElement:
        "Use SimpleTable from 'sentry/components/tables/simpleTable' instead of a raw <{{element}}>.",
      panelHeaderColumns:
        "This PanelHeader is laid out as table columns. Use SimpleTable from 'sentry/components/tables/simpleTable' instead.",
      sharedGridTemplate:
        "This grid template is shared by a header and repeated rows, like a table. Use SimpleTable from 'sentry/components/tables/simpleTable' instead.",
    },
  },
  create(context) {
    const importTracker = createImportTracker(context);
    const templateUses = new Map<unknown, TemplateUse[]>();

    function addTemplateUse(key: unknown, use: TemplateUse) {
      const uses = templateUses.get(key);
      if (uses) {
        uses.push(use);
      } else {
        templateUses.set(key, [use]);
      }
    }

    function addStyledUses(key: unknown, node: ESTree.Node, repetitions: boolean[]) {
      for (const repeated of repetitions) {
        addTemplateUse(key, {node, repeated});
      }
    }

    function constantInit(node: ESTree.Node): ESTree.Node | null {
      const definition = importTracker.resolveVariable(node)?.defs[0];
      if (
        definition?.node.type === 'VariableDeclarator' &&
        definition.parent?.type === 'VariableDeclaration' &&
        definition.parent.kind === 'const'
      ) {
        return definition.node.init ?? null;
      }
      return null;
    }

    function templateKey(node: ESTree.Node): unknown {
      if (
        belowMinimumTracks(node) ||
        (node.type === 'Identifier' && belowMinimumTracks(constantInit(node)))
      ) {
        return null;
      }
      const literal = staticString(node);
      if (literal !== null) {
        return `literal:${normalizeSpace(literal)}`;
      }
      if (node.type === 'Identifier') {
        return importTracker.resolveVariable(node) ?? `name:${node.name}`;
      }
      return `source:${normalizeSpace(context.sourceCode.getText(node))}`;
    }

    function isGridMixin(node: ESTree.Node): boolean {
      if (node.type !== 'Identifier') {
        return false;
      }
      const init = constantInit(node);
      return init
        ? context.sourceCode.getText(init).includes('grid-template-columns')
        : GRID_MIXIN_NAME.test(node.name);
    }

    function styledRepetitions(node: ESTree.Node): boolean[] {
      const declarator = node.parent;
      if (
        declarator?.type !== 'VariableDeclarator' ||
        declarator.id.type !== 'Identifier'
      ) {
        return [false];
      }
      const reads =
        importTracker
          .resolveVariable(declarator.id)
          ?.references.filter(reference => reference.isRead()) ?? [];
      return reads.length > 0
        ? reads.map(reference => isIterated(reference.identifier))
        : [false];
    }

    function checkStyled(node: ESTree.TaggedTemplateExpression | ESTree.CallExpression) {
      const styled = getStyledCallInfo(node, importTracker);
      if (!styled || styled.kind === 'css') {
        return;
      }

      if (styled.kind === 'element' && TABLE_ELEMENTS.has(styled.name)) {
        context.report({node, messageId: 'tableElement', data: {element: styled.name}});
        return;
      }

      const template =
        node.type === 'TaggedTemplateExpression'
          ? node.quasi
          : node.arguments[0]?.type === 'TemplateLiteral'
            ? node.arguments[0]
            : null;
      if (!template) {
        return;
      }

      const declarations =
        parseCssTemplate(template, context.sourceCode.getText(template))?.filter(
          declaration => declaration.root
        ) ?? [];
      const declared = new Set(
        declarations.flatMap(declaration =>
          declaration.interpolations.map(interpolation => interpolation.expression)
        )
      );
      const mixins = template.expressions.filter(
        expression => !declared.has(expression) && isGridMixin(expression)
      );
      const columns = declarations.find(
        declaration => declaration.name === 'grid-template-columns'
      );

      if (
        styled.kind === 'component' &&
        (columns || mixins.length > 0) &&
        importTracker
          .findLocalNames(PANEL_HEADER_SOURCE, 'PanelHeader')
          .includes(styled.name)
      ) {
        context.report({node, messageId: 'panelHeaderColumns'});
        return;
      }

      const repetitions = styledRepetitions(node);
      for (const mixin of mixins) {
        addStyledUses(importTracker.resolveVariable(mixin), node, repetitions);
      }
      if (!columns) {
        return;
      }

      const [interpolation] = columns.interpolations;

      if (columns.interpolations.length === 1 && interpolation) {
        const key = templateKey(interpolation.expression);
        if (key !== null) {
          addStyledUses(key, node, repetitions);
        }
      } else if (
        columns.interpolations.length === 0 &&
        countTracks(columns.value) >= MINIMUM_SHARED_TRACKS
      ) {
        addStyledUses(`literal:${normalizeSpace(columns.value)}`, node, repetitions);
      }
    }

    return {
      ...importTracker.visitors,
      TaggedTemplateExpression: checkStyled,
      CallExpression: checkStyled,
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && TABLE_ELEMENTS.has(node.name.name)) {
          context.report({
            node: node.name,
            messageId: 'tableElement',
            data: {element: node.name.name},
          });
          return;
        }

        const as = staticString(attributeExpression(attribute(node, 'as')));
        if (as && TABLE_ELEMENTS.has(as)) {
          context.report({node, messageId: 'tableElement', data: {element: as}});
          return;
        }

        if (!importTracker.is(node.name, LAYOUT_SOURCE, 'Grid')) {
          return;
        }

        const columns = attributeExpression(attribute(node, 'columns'));
        const key = columns && templateKey(columns);
        if (key) {
          addTemplateUse(key, {node, repeated: isIterated(node)});
        }
      },
      'Program:exit'() {
        for (const uses of templateUses.values()) {
          if (uses.some(use => use.repeated) && uses.some(use => !use.repeated)) {
            for (const node of new Set(uses.map(use => use.node))) {
              context.report({node, messageId: 'sharedGridTemplate'});
            }
          }
        }
      },
    };
  },
});
