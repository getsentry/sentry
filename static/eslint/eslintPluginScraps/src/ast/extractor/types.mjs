/**
 * @file Type definitions for the Style Declaration IR
 *
 * This module defines the intermediate representation (IR) used by all
 * style extractors and consumed by lint rules.
 */

/**
 * Represents a single CSS property declaration found in the source code.
 *
 * @typedef {Object} StyleDeclaration
 * @property {'styled' | 'css-prop' | 'style-prop' | 'theme'} kind
 *   The type of style context this declaration was found in.
 * @property {StyleProperty} property
 *   Information about the CSS property being set.
 * @property {StyleValue[]} values
 *   All possible values this property could resolve to (handles ternaries, etc.).
 * @property {StyleContext} context
 *   Contextual information about where the declaration was found.
 * @property {StyleRawNodes} raw
 *   References to the original AST nodes for error reporting.
 */

/**
 * Information about a CSS property in a style declaration.
 *
 * @typedef {Object} StyleProperty
 * @property {string} name
 *   Canonical CSS property name in kebab-case (e.g., 'background-color').
 * @property {import('estree').Node} node
 *   The AST node representing the property (for error location).
 */

/**
 * A possible value for a CSS property.
 *
 * @typedef {Object} StyleValue
 * @property {import('estree').Node} node
 *   The AST node representing this value.
 * @property {'literal' | 'template-quasi' | 'member' | 'call' | 'conditional' | 'logical' | 'unknown'} kind
 *   The type of expression this value comes from.
 * @property {boolean} confident
 *   Whether this value can be statically analyzed with confidence.
 * @property {TokenInfo | null} tokenInfo
 *   If this value is a theme token reference, contains token path info.
 */

/**
 * Information about a theme token reference.
 *
 * @typedef {Object} TokenInfo
 * @property {string} tokenPath
 *   The full token path (e.g., 'content.primary').
 * @property {string} tokenName
 *   The final token name (e.g., 'primary').
 * @property {import('estree').Node} node
 *   The member expression node for precise error highlighting.
 */

/**
 * Context information for a style declaration.
 *
 * @typedef {Object} StyleContext
 * @property {string} file
 *   The filename where this declaration was found.
 * @property {number} scopeId
 *   Unique identifier for the scope (for theme binding resolution).
 * @property {ThemeBinding | null} themeBinding
 *   If a theme binding is active in scope, contains binding info.
 */

/**
 * Information about a theme variable binding.
 *
 * @typedef {Object} ThemeBinding
 * @property {string} localName
 *   The local variable name (e.g., 'theme', 't', 'p').
 * @property {'useTheme' | 'styled-callback' | 'css-callback'} source
 *   How the theme binding was created.
 * @property {import('estree').Node} declarationNode
 *   The node where the binding was declared.
 */

/**
 * Raw AST node references for a style declaration.
 *
 * @typedef {Object} StyleRawNodes
 * @property {import('estree').Node} containerNode
 *   The containing node (template literal, object expression, etc.).
 * @property {import('estree').Node} sourceNode
 *   The root styled/css/style node.
 */

/**
 * The style collector accumulates declarations from all extractors.
 *
 * @typedef {Object} StyleCollector
 * @property {(decl: StyleDeclaration) => void} add
 *   Add a style declaration to the collection.
 * @property {() => StyleDeclaration[]} getAll
 *   Get all collected declarations.
 * @property {() => void} clear
 *   Clear all declarations (call at end of file).
 */

/**
 * Context passed to extractor factory functions.
 *
 * @typedef {Object} ExtractorContext
 * @property {StyleCollector} collector
 *   The collector to add declarations to.
 * @property {ThemeTracker} themeTracker
 *   The theme binding tracker.
 * @property {import('eslint').Rule.RuleContext} ruleContext
 *   The ESLint rule context.
 */

/**
 * Interface for the theme tracker.
 *
 * @typedef {Object} ThemeTracker
 * @property {Record<string, Function>} visitors
 *   ESLint visitor functions for tracking theme bindings.
 * @property {(name: string) => boolean} isThemeBinding
 *   Check if a name is a known theme binding.
 * @property {() => ThemeBinding | null} getActiveBinding
 *   Get the currently active theme binding.
 * @property {() => number} getCurrentScopeId
 *   Get the current scope ID.
 * @property {(name: string, node: import('estree').Node) => void} registerCallbackBinding
 *   Register a callback parameter as a theme binding.
 */

export {};
