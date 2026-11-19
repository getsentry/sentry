import {readFileSync} from 'node:fs';
import path from 'node:path';

import {darkTheme, lightTheme} from './theme';
import {themeVariables} from './variables';

const css = readFileSync(path.join(__dirname, 'variables.css'), 'utf8');

/**
 * Custom properties declared by each rule, keyed by its enclosing at-rules and
 * selector list, e.g. `@layer scraps.tokens > [data-color-scheme='dark']`.
 */
function declarationsByRule(source: string) {
  const rules = new Map<string, Map<string, string>>();
  const atRules: string[] = [];
  let selector: string[] = [];
  let current: Map<string, string> | undefined;

  for (const line of source.split('\n').map(raw => raw.trim())) {
    if (line.startsWith('@') && line.endsWith('{')) {
      atRules.push(line.slice(0, -1).trim());
    } else if (line.endsWith(',')) {
      selector.push(line.slice(0, -1));
    } else if (line.endsWith('{')) {
      selector.push(line.slice(0, -1).trim());
      current = new Map();
      rules.set([...atRules, selector.join(', ')].join(' > '), current);
      selector = [];
    } else if (line === '}') {
      if (current) {
        current = undefined;
      } else {
        atRules.pop();
      }
    } else if (current && line.startsWith('--')) {
      const [name = '', ...value] = line.slice(0, -1).split(':');
      current.set(name.trim(), value.join(':').trim());
    }
  }

  return rules;
}

function leaves(value: unknown, keys: string[] = []): Array<[string[], string]> {
  if (typeof value === 'string') {
    return [[keys, value]];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, [...keys, key]));
  }
  return [];
}

function valueAt(tree: unknown, keys: string[]): unknown {
  return keys.reduce<any>((node, key) => node?.[key], tree);
}

const rules = declarationsByRule(css);
const references = leaves(themeVariables);

const schemes = [
  {
    name: 'light',
    rule: "@layer scraps.tokens > :root, [data-color-scheme='light'], [data-color-scheme='system']",
    theme: lightTheme,
  },
  {
    name: 'dark',
    rule: "@layer scraps.tokens > [data-color-scheme='dark']",
    theme: darkTheme,
  },
  {
    name: 'system with an OS dark preference',
    rule: "@layer scraps.tokens > @media (prefers-color-scheme: dark) > [data-color-scheme='system']",
    theme: darkTheme,
  },
];

describe('theme variables', () => {
  it('only references --scraps-* custom properties', () => {
    expect(references.length).toBeGreaterThan(0);
    const invalid = references.filter(
      ([, reference]) => !/^var\(--scraps-[a-z0-9-]+\)$/.test(reference)
    );
    expect(invalid).toEqual([]);
  });

  it.each(schemes)(
    'declares the $name theme value for every variable',
    ({rule, theme}) => {
      const declarations = rules.get(rule);
      expect(declarations).toBeDefined();

      const mismatches = references.flatMap(([keys, reference]) => {
        const name = reference.slice('var('.length, -1);
        const expected = String(valueAt(theme, keys)).toLowerCase();
        const actual = declarations?.get(name)?.toLowerCase();
        return actual === expected ? [] : [{name, expected, actual}];
      });

      expect(mismatches).toEqual([]);
    }
  );
});
