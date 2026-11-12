// oxlint-disable-next-line import/no-nodejs-modules -- CSS parsing runs in oxlint's Node plugin host.
import {createRequire} from 'node:module';

import type {ESTree} from '@oxlint/plugins';

import {normalizePropertyName} from '../utils/normalizePropertyName.ts';

type CssNode = {
  type: string;
  important?: boolean;
  name?: string;
  nodes?: CssNode[];
  params?: string;
  prop?: string;
  raws?: {before?: string; between?: string};
  selector?: string;
  source?: {
    end?: {line?: number; offset?: number};
    start?: {line?: number; offset?: number};
  };
  text?: string;
  value?: string;
};
type CssDocument = {nodes: CssNode[]};
type CssParser = {parse: (source: string, options: {from: string}) => CssDocument};

interface CssDirective {
  action: string;
  endLine: number | undefined;
  line: number | undefined;
  offset: number;
  rules: string[];
}

export interface ParsedCssDeclaration {
  directives: CssDirective[];
  important: boolean;
  interpolations: Array<{expression: ESTree.Expression; index: number}>;
  line: number | undefined;
  name: string;
  root: boolean;
  sourceRange: [number, number] | null;
  value: string;
  valueRange: [number, number] | null;
}

export interface ParsedCssAtRule {
  name: string;
  params: string;
}

export interface ParsedCssSelector {
  directives: CssDirective[];
  interpolations: Array<{expression: ESTree.Expression; range: [number, number]}>;
  line: number | undefined;
  sourceRange: [number, number];
  value: string;
}

const styledSyntax: CssParser = createRequire(import.meta.url)('postcss-styled-syntax');
const PREFIX = 'styled.div';

function valueStart(node: CssNode, source: string): number | undefined {
  const start = node.source?.start?.offset;
  if (start === undefined || node.prop === undefined) {
    return undefined;
  }
  const propertyEnd = start + node.prop.length;
  if (node.raws?.between) {
    return propertyEnd + node.raws.between.length;
  }
  const colon = source.indexOf(':', propertyEnd);
  return colon === -1 ? undefined : colon + 1;
}

function parseCss(source: string): CssDocument | null {
  try {
    return styledSyntax.parse(source, {from: 'style.tsx'});
  } catch (error) {
    if (error instanceof Error && error.name === 'CssSyntaxError') {
      return null;
    }
    throw error;
  }
}

/** Decode JavaScript template escapes after slicing by the original source offsets. */
export function cookCssTemplateText(raw: string): string {
  return raw.replace(
    /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|\r\n|[\s\S])/g,
    escape => {
      const value = escape.slice(1);
      if (value.startsWith('u{')) {
        const point = Number.parseInt(value.slice(2, -1), 16);
        return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
      }
      if (/^[ux][\da-fA-F]+$/.test(value)) {
        return String.fromCharCode(Number.parseInt(value.slice(1), 16));
      }
      const escapes: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        v: '\v',
        '0': '\0',
        '\n': '',
        '\r': '',
        '\r\n': '',
      };
      return escapes[value] ?? value;
    }
  );
}

/** Parse a complete styled template and map each interpolation to its CSS value declaration. */
export function parseCssTemplate(
  template: ESTree.TemplateLiteral | null,
  source: string,
  atRules?: ParsedCssAtRule[],
  selectors?: ParsedCssSelector[]
): ParsedCssDeclaration[] | null {
  const templateStart = template?.range[0] ?? 0;
  const parsedSource = `${PREFIX}${source}`;
  const root = parseCss(parsedSource)?.nodes[0];
  if (!root) {
    return null;
  }

  const declarations: ParsedCssDeclaration[] = [];
  const directives: CssDirective[] = [];
  const walk = (nodes: CssNode[], isRoot: boolean, keyframes = false) => {
    for (const node of nodes) {
      if (
        selectors &&
        !keyframes &&
        node.type === 'rule' &&
        node.selector !== undefined &&
        node.source?.start?.offset !== undefined
      ) {
        const selectorStart = node.source.start.offset - PREFIX.length;
        const end = selectorStart + node.selector.length;
        let start = selectorStart;
        // The syntax parser puts standalone interpolations in raws.before.
        // They can still be component selectors continued on the next line.
        const beforeStart = selectorStart - (node.raws?.before?.length ?? 0);
        for (const expression of template?.expressions ?? []) {
          const from = expression.range[0] - templateStart - 2;
          const to = expression.range[1] - templateStart + 1;
          if (from >= beforeStart && to <= selectorStart) {
            start = Math.min(start, from);
          }
        }
        selectors.push({
          directives,
          line: node.source.start.line,
          sourceRange: [start, end],
          value: source.slice(start, end),
          interpolations: (template?.expressions ?? []).flatMap(expression => {
            const from = expression.range[0] - templateStart - 2;
            const to = expression.range[1] - templateStart + 1;
            return from >= start && to <= end
              ? [{expression, range: [from - start, to - start]}]
              : [];
          }),
        });
      }
      if (node.type === 'atrule' && node.name && node.params !== undefined) {
        atRules?.push({name: node.name, params: node.params});
      }
      if (node.type === 'comment' && node.source?.start?.offset !== undefined) {
        const match = node.text
          ?.split(/\s--(?:\s|$)/)[0]
          ?.trim()
          .match(
            /^(?:eslint|oxlint)-(disable-next-line|disable-line|disable|enable)(?:\s|$)(.*)$/s
          );
        if (match) {
          directives.push({
            action: match[1]!,
            rules: match[2]!.split(/[\s,]+/).filter(Boolean),
            line: node.source.start.line,
            endLine: node.source.end?.line,
            offset: node.source.start.offset - PREFIX.length,
          });
        }
      }
      if (node.type === 'decl' && node.prop !== undefined && node.value !== undefined) {
        const sourceStart = node.source?.start?.offset;
        const sourceEnd = node.source?.end?.offset;
        const start = valueStart(node, parsedSource);
        const sourceRange: [number, number] | null =
          sourceStart === undefined || sourceEnd === undefined
            ? null
            : [sourceStart - PREFIX.length, sourceEnd - PREFIX.length];
        const valueRange: [number, number] | null =
          start === undefined || sourceEnd === undefined
            ? null
            : [start - PREFIX.length, sourceEnd - PREFIX.length];
        const interpolations = (template?.expressions ?? []).flatMap(
          (expression, index) => {
            if (
              sourceStart === undefined ||
              sourceEnd === undefined ||
              start === undefined
            ) {
              return [];
            }
            const expressionStart = expression.range[0] - templateStart + PREFIX.length;
            const end = expression.range[1] - templateStart + PREFIX.length;
            return start <= expressionStart && sourceEnd >= end
              ? [{expression, index}]
              : [];
          }
        );

        declarations.push({
          directives,
          important: node.important ?? false,
          interpolations,
          line: node.source?.start?.line,
          name: normalizePropertyName(node.prop),
          root: isRoot,
          sourceRange,
          value: node.value,
          valueRange,
        });
      } else if (node.nodes) {
        walk(
          node.nodes,
          false,
          keyframes || (node.type === 'atrule' && /keyframes$/i.test(node.name ?? ''))
        );
      }
    }
  };
  walk(root.nodes ?? [], true);
  return declarations;
}
