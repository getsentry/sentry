/**
 * Types for the compiled `grammar.pegjs` module.
 *
 * The grammar builds every token through `options.TokenConverter`, so the
 * caller decides the token shapes and the key-type predicates. See
 * `./parser.ts` for the structural converter this package ships.
 */

import type {ConverterOptions, SearchConfig, SourceLocation} from './parser';
import type {FilterType, TermOperator} from './tokens';

/** Converter methods whose tokens can appear at the top level of a result. */
type TopLevelTokenBuilder =
  | 'tokenFilter'
  | 'tokenFreeText'
  | 'tokenLogicBoolean'
  | 'tokenLogicGroup'
  | 'tokenLParen'
  | 'tokenRegexFilter'
  | 'tokenRParen'
  | 'tokenSpaces';

/** Converter methods that build tokens nested inside top-level tokens. */
type NestedTokenBuilder =
  | 'tokenKeyAggregate'
  | 'tokenKeyAggregateArgs'
  | 'tokenKeyAggregateParam'
  | 'tokenKeyArrayIncludes'
  | 'tokenKeyExplicitArrayTag'
  | 'tokenKeyExplicitBooleanTag'
  | 'tokenKeyExplicitFlag'
  | 'tokenKeyExplicitNumberFlag'
  | 'tokenKeyExplicitNumberTag'
  | 'tokenKeyExplicitStringFlag'
  | 'tokenKeyExplicitStringTag'
  | 'tokenKeyExplicitTag'
  | 'tokenKeySimple'
  | 'tokenValueBoolean'
  | 'tokenValueDuration'
  | 'tokenValueIso8601Date'
  | 'tokenValueNumber'
  | 'tokenValueNumberList'
  | 'tokenValuePercentage'
  | 'tokenValueRelativeDate'
  | 'tokenValueSize'
  | 'tokenValueText'
  | 'tokenValueTextList';

/** Converter methods the grammar uses to accept or reject a match. */
type GrammarPredicate =
  | 'predicateFilter'
  | 'predicateParenGroup'
  | 'predicateTextOperator';

/**
 * The methods the grammar calls on its converter. The structural
 * `TokenConverter` in `./parser.ts` implements them; a caller can pass any
 * class that does.
 */
export type GrammarTokenConverter = Record<
  TopLevelTokenBuilder | NestedTokenBuilder,
  (...args: never[]) => object
> &
  // Peggy treats a falsy predicate result, including `undefined`, as no match.
  Record<GrammarPredicate, (...args: never[]) => boolean | undefined>;

/** Options passed to {@link parse}. */
export type GrammarOptions<C extends SearchConfig, T extends GrammarTokenConverter> = {
  /** The search config handed to the converter. */
  config: C;
  /** The filter type enum the grammar classifies filters with. */
  FilterType: typeof FilterType;
  /** The term operator enum. The grammar reads its `DEFAULT` member. */
  TermOperator: typeof TermOperator;
  /**
   * Builds every token. The grammar constructs it once per parse and calls
   * its `token*` builders and `predicate*` checks from the grammar actions.
   */
  TokenConverter: new (options: ConverterOptions<C>) => T;
  /** The grammar has a single start rule. */
  startRule?: 'search';
};

/**
 * The tokens {@link parse} returns for a converter: whatever its top-level
 * builders return. With the structural `TokenConverter` this is `ParseResult`.
 */
export type GrammarResult<T extends GrammarTokenConverter> = Array<
  ReturnType<T[TopLevelTokenBuilder]>
>;

/** A literal string the grammar expected at the failure position. */
type LiteralExpectation = {
  ignoreCase: boolean;
  text: string;
  type: 'literal';
};

/** Nested character class ranges, e.g. `[a-z]` as `[['a', 'z']]`. */
type ClassParts = Array<string | ClassParts>;

/** A character class the grammar expected at the failure position. */
type ClassExpectation = {
  ignoreCase: boolean;
  inverted: boolean;
  parts: ClassParts;
  type: 'class';
};

/** Any character was expected at the failure position. */
type AnyExpectation = {type: 'any'};

/** The end of input was expected at the failure position. */
type EndExpectation = {type: 'end'};

/** A named grammar rule was expected at the failure position. */
type OtherExpectation = {description: string; type: 'other'};

/** Something the grammar could have matched where parsing failed. */
export type Expectation =
  | LiteralExpectation
  | ClassExpectation
  | AnyExpectation
  | EndExpectation
  | OtherExpectation;

/** Thrown by {@link parse} when the input does not match the grammar. */
export declare class SyntaxError extends Error {
  /** What the grammar could have matched where parsing failed. */
  expected: Expectation[] | null;
  /** The text found where parsing failed, or `null` at the end of input. */
  found: string | null;
  /** Where parsing failed. */
  location: SourceLocation;
}

/**
 * Parse a search query into the tokens the converter builds. Throws
 * {@link SyntaxError} when the query does not match the grammar.
 */
export declare function parse<C extends SearchConfig, T extends GrammarTokenConverter>(
  input: string,
  options: GrammarOptions<C, T>
): GrammarResult<T>;
