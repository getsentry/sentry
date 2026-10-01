// oxlint-disable-next-line import/no-nodejs-modules -- CSS parsing runs in oxlint's Node plugin host.
import {createRequire} from 'node:module';

import type {ESTree} from '@oxlint/plugins';

import {normalizePropertyName} from '../utils/normalizePropertyName.ts';

type CssNode = {
  type: string;
  important?: boolean;
  nodes?: CssNode[];
  prop?: string;
  raws?: {between?: string};
  source?: {end?: {offset?: number}; start?: {offset?: number}};
  value?: string;
};
type CssDocument = {nodes: CssNode[]};
type CssParser = {parse: (source: string, options: {from: string}) => CssDocument};

export interface ParsedCssDeclaration {
  important: boolean;
  interpolations: Array<{expression: ESTree.Expression; index: number}>;
  name: string;
  root: boolean;
  sourceRange: [number, number] | null;
  value: string;
  valueRange: [number, number] | null;
}

const styledSyntax: CssParser = createRequire(import.meta.url)('postcss-styled-syntax');
const PREFIX = 'styled.div';

/** Parse a complete styled template and map each interpolation to its CSS value declaration. */
export function parseCssTemplate(
  template: ESTree.TemplateLiteral,
  source: string
): ParsedCssDeclaration[] | null {
  let document: CssDocument;
  try {
    document = styledSyntax.parse(`${PREFIX}${source}`, {from: 'style.tsx'});
  } catch (error) {
    if (error instanceof Error && error.name === 'CssSyntaxError') {
      return null;
    }
    throw error;
  }

  const root = document.nodes[0];
  if (!root) {
    return null;
  }

  const parsedSource = `${PREFIX}${source}`;
  const declarations: ParsedCssDeclaration[] = [];
  const walk = (nodes: CssNode[], isRoot: boolean) => {
    for (const node of nodes) {
      if (node.type === 'decl' && node.prop !== undefined && node.value !== undefined) {
        const sourceStart = node.source?.start?.offset;
        const sourceEnd = node.source?.end?.offset;
        const propertyEnd =
          sourceStart === undefined ? undefined : sourceStart + node.prop.length;
        const colon =
          propertyEnd === undefined ? -1 : parsedSource.indexOf(':', propertyEnd);
        const valueStart =
          propertyEnd === undefined
            ? undefined
            : node.raws?.between
              ? propertyEnd + node.raws.between.length
              : colon === -1
                ? undefined
                : colon + 1;
        const sourceRange: [number, number] | null =
          sourceStart === undefined || sourceEnd === undefined
            ? null
            : [sourceStart - PREFIX.length, sourceEnd - PREFIX.length];
        const valueRange: [number, number] | null =
          valueStart === undefined || sourceEnd === undefined
            ? null
            : [valueStart - PREFIX.length, sourceEnd - PREFIX.length];
        const interpolations = template.expressions.flatMap((expression, index) => {
          if (
            sourceStart === undefined ||
            sourceEnd === undefined ||
            valueStart === undefined
          ) {
            return [];
          }
          const start = expression.range[0] - template.range[0] + PREFIX.length;
          const end = expression.range[1] - template.range[0] + PREFIX.length;
          return valueStart <= start && sourceEnd >= end ? [{expression, index}] : [];
        });

        declarations.push({
          important: node.important ?? false,
          interpolations,
          name: normalizePropertyName(node.prop),
          root: isRoot,
          sourceRange,
          value: node.value,
          valueRange,
        });
      } else if (node.nodes) {
        walk(node.nodes, false);
      }
    }
  };
  walk(root.nodes ?? [], true);
  return declarations;
}
