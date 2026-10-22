/**
 * Types for the compiled `grammar.pegjs` module.
 *
 * The grammar builds every token through `options.TokenConverter`, so the
 * caller decides the token shapes and the key-type predicates. See
 * `./parser.ts` for the structural converter this package ships.
 */

export type GrammarOptions = {
  /** Constructed with `{text, location, config}` once per parse. */
  TokenConverter: new (opts: any) => unknown;
  FilterType: Record<string, string>;
  TermOperator: {DEFAULT: string};
  config: unknown;
  startRule?: 'search';
};

export declare class SyntaxError extends Error {
  expected: unknown;
  found: string | null;
  location: unknown;
}

/** Parse a search query. Throws {@link SyntaxError} when it does not match. */
export declare function parse(input: string, options: GrammarOptions): any;
