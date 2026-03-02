/**
 * @file Type definitions for the Style Declaration IR
 *
 * This module defines the intermediate representation (IR) used by all
 * style extractors and consumed by lint rules.
 */

import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

/**
 * Represents a single CSS property declaration found in the source code.
 */
export interface StyleDeclaration {
  /**
   * Contextual information about where the declaration was found.
   */
  context: StyleContext;

  /**
   * The type of style context this declaration was found in.
   */
  kind: 'styled' | 'css-prop' | 'style-prop' | 'theme';

  /**
   * Information about the CSS property being set.
   */
  property: StyleProperty;

  /**
   * References to the original AST nodes for error reporting.
   */
  raw: StyleRawNodes;

  /**
   * All possible values this property could resolve to (handles ternaries, etc.).
   */
  values: StyleValue[];
}

/**
 * Information about a CSS property in a style declaration.
 */
export interface StyleProperty {
  /**
   * Canonical CSS property name in kebab-case (e.g., 'background-color').
   */
  name: string;

  /**
   * The AST node representing the property (for error location).
   */
  node: TSESTree.Node;
}

/**
 * A possible value for a CSS property.
 */
export interface StyleValue {
  /**
   * Whether this value can be statically analyzed with confidence.
   */
  confident: boolean;

  /**
   * The type of expression this value comes from.
   */
  kind:
    | 'literal'
    | 'template-quasi'
    | 'member'
    | 'call'
    | 'conditional'
    | 'logical'
    | 'unknown';

  /**
   * The AST node representing this value.
   */
  node: TSESTree.Node;

  /**
   * If this value is a theme token reference, contains token path info.
   */
  tokenInfo: TokenInfo | null;
}

/**
 * Information about a theme token reference.
 */
export interface TokenInfo {
  /**
   * The member expression node for precise error highlighting.
   */
  node: TSESTree.Node;

  /**
   * The final token name (e.g., 'primary').
   */
  tokenName: string;

  /**
   * The full token path (e.g., 'content.primary').
   */
  tokenPath: string;
}

/**
 * Context information for a style declaration.
 */
export interface StyleContext {
  /**
   * The filename where this declaration was found.
   */
  file: string;

  /**
   * Unique identifier for the scope (for theme binding resolution).
   */
  scopeId: number;

  /**
   * If a theme binding is active in scope, contains binding info.
   */
  themeBinding: ThemeBinding | null;
}

/**
 * Information about a theme variable binding.
 */
export interface ThemeBinding {
  /**
   * The node where the binding was declared.
   */
  declarationNode: TSESTree.Node;

  /**
   * The local variable name (e.g., 'theme', 't', 'p').
   */
  localName: string;

  /**
   * How the theme binding was created.
   */
  source: 'useTheme' | 'styled-callback' | 'css-callback';
}

/**
 * Raw AST node references for a style declaration.
 */
export interface StyleRawNodes {
  /**
   * The containing node (template literal, object expression, etc.).
   */
  containerNode: TSESTree.Node;

  /**
   * The root styled/css/style node.
   */
  sourceNode: TSESTree.Node;
}

/**
 * The style collector accumulates declarations from all extractors.
 */
export interface StyleCollector {
  /**
   * Add a style declaration to the collection.
   */
  add: (decl: StyleDeclaration) => void;

  /**
   * Clear all declarations (call at end of file).
   */
  clear: () => void;

  /**
   * Get all collected declarations.
   */
  getAll: () => StyleDeclaration[];
}

/**
 * Context passed to extractor factory functions.
 */
export interface ExtractorContext {
  /**
   * The collector to add declarations to.
   */
  collector: StyleCollector;

  /**
   * The ESLint rule context.
   */
  ruleContext: TSESLint.RuleContext<string, unknown[]>;

  /**
   * The theme binding tracker.
   */
  themeTracker: ThemeTracker;
}

/**
 * Interface for the theme tracker.
 */
export interface ThemeTracker {
  /**
   * Get the currently active theme binding.
   */
  getActiveBinding: () => ThemeBinding | null;

  /**
   * Get the current scope ID.
   */
  getCurrentScopeId: () => number;

  /**
   * Check if a name is a known theme binding.
   */
  isThemeBinding: (name: string) => boolean;

  /**
   * Register a callback parameter as a theme binding.
   */
  registerCallbackBinding: (name: string, node: TSESTree.Node) => void;

  /**
   * ESLint visitor functions for tracking theme bindings.
   */
  visitors: TSESLint.RuleListener;
}
