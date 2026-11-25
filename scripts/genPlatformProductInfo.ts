/**
 * Generates static/app/data/platformProductInfo.generated.ts.
 *
 * Sources:
 *   - static/app/data/platforms.tsx               (platform IDs + docs links + deprecated flag)
 *   - static/app/components/onboarding/productSelection.tsx (legacy toggleable map keys)
 *   - static/app/data/platformCategories.tsx      (withMetricsOnboarding gate)
 *   - static/app/gettingStartedDocs/<platform>/   (wizard-driven detection)
 *   - getsentry/sentry-docs MDX frontmatter       (per-feature notSupported/supported)
 *
 * Resolves "what products apply to each wizard-driven platform that is NOT in
 * platformProductAvailability" by mirroring sentry-docs/src/frontmatter.ts:isSupported,
 * then writes a generated TS file that the SCM onboarding info-card path consumes.
 * Platforms without a wizard AND without curated toggles render nothing on the SCM step.
 *
 * Usage:
 *   pnpm gen:platform-info               # uses ../sentry-docs as the docs checkout
 *   SENTRY_DOCS_PATH=/path node scripts/genPlatformProductInfo.ts
 */
import {existsSync, globSync, readFileSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';

import {
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isIdentifier,
  isNewExpression,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  isTypeAssertion,
  isVariableStatement,
  type PropertyAssignment,
  type SourceFile,
  SyntaxKind,
} from 'tsrs/ast';
import {API} from 'tsrs/sync';
import {parse as parseYaml} from 'yaml';

const SENTRY_ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_ROOT = process.env.SENTRY_DOCS_PATH
  ? path.resolve(process.env.SENTRY_DOCS_PATH)
  : path.resolve(SENTRY_ROOT, '..', 'sentry-docs');
const DOCS_PLATFORMS_DIR = path.join(DOCS_ROOT, 'docs', 'platforms');

const PLATFORMS_PATH = path.join(SENTRY_ROOT, 'static/app/data/platforms.tsx');
const PSP_PATH = path.join(
  SENTRY_ROOT,
  'static/app/components/onboarding/productSelection.tsx'
);
const CATEGORIES_PATH = path.join(SENTRY_ROOT, 'static/app/data/platformCategories.tsx');
const GETTING_STARTED_DOCS_DIR = path.join(SENTRY_ROOT, 'static/app/gettingStartedDocs');
const OUTPUT_PATH = path.join(
  SENTRY_ROOT,
  'static/app/data/platformProductInfo.generated.ts'
);

// Match references to the Sentry CLI install wizard. Used to detect platforms
// whose setup-docs install step is wizard-driven (`npx @sentry/wizard ...`)
// and therefore can't surface product toggles to the user.
const WIZARD_PATTERN = /sentry\/wizard|sentry-wizard|wizardLink:/i;

if (!existsSync(DOCS_PLATFORMS_DIR)) {
  console.error(
    `sentry-docs not found at ${DOCS_PLATFORMS_DIR}.\n` +
      `Set SENTRY_DOCS_PATH or check out getsentry/sentry-docs as a sibling of sentry.`
  );
  process.exit(1);
}

interface PlatformEntry {
  deprecated: boolean;
  guide: string | null;
  id: string;
  lang: string | null;
}

// Map of toggleable products to their sentry-docs feature directory. Mirrors
// the FEATURE_DISPLAY_ORDER in scmPlatformFeatures.tsx, minus ERROR_MONITORING
// (always implicit). METRICS is also gated on withMetricsOnboarding.
const FEATURES: Record<string, string> = {
  LOGS: 'logs',
  SESSION_REPLAY: 'session-replay',
  PERFORMANCE_MONITORING: 'tracing',
  PROFILING: 'profiling',
  METRICS: 'metrics',
};

// Overrides for (platform, product) combinations that the sentry-docs
// frontmatter declares as supported, but which the SDK owners have asked us
// not to surface in new-project onboarding (typically because the feature is
// still alpha or has narrower real-world scope than the frontmatter implies).
//
// Keep this list small and document the rationale per-entry so future
// regenerations don't quietly drop or restore overrides.
const PRODUCT_EXCLUSIONS: Record<string, Set<string>> = {
  // Flutter profiling is still alpha and iOS/macOS-only as of 2026-05.
  // Confirmed by Chris Aigner (Flutter SDK) in #team-value-discovery.
  flutter: new Set(['PROFILING']),
};

// Sentry platform-ids whose docs canonical doesn't fall out of the link path.
// Most platforms map cleanly via /platforms/<lang>/(guides|integrations)/<guide>/.
const CANONICAL_OVERRIDES: Record<string, {lang: string; guide?: string}> = {
  'apple-ios': {lang: 'apple', guide: 'ios'},
  'apple-macos': {lang: 'apple', guide: 'macos'},
  'cocoa-objc': {lang: 'apple', guide: 'ios'},
  'cocoa-swift': {lang: 'apple', guide: 'ios'},
  flutter: {lang: 'dart', guide: 'flutter'},
  minidump: {lang: 'native', guide: 'minidump'},
  'native-qt': {lang: 'native', guide: 'qt'},
  // python-pyramid's link in platforms.tsx is `/platforms/python/pyramid/`
  // (no `/integrations/` segment), so the link parser falls through. The
  // sentry-docs canonical is `python.pyramid` (lives at
  // `docs/platforms/python/integrations/pyramid/`).
  'python-pyramid': {lang: 'python', guide: 'pyramid'},
};

// Console / sentinel platforms with no docs subtree to resolve.
const NO_DOCS_TREE = new Set(['nintendo-switch', 'playstation', 'xbox', 'other']);

function parseLink(link: string): {lang: string; guide?: string} | null {
  const m = link.match(
    /\/platforms\/([\w-]+)(?:\/(?:guides|integrations)\/([\w-]+))?\/?/
  );
  if (!m) {
    return null;
  }
  return {lang: m[1]!, guide: m[2]};
}

// === AST helpers ============================================================
// We parse the source TS files (platforms.tsx, productSelection.tsx,
// platformCategories.tsx) with the tsrs compiler API instead of
// importing the values directly: importing them would pull in the React
// runtime, browser globals, and webpack-style path aliases that don't resolve
// in plain Node. AST parsing is enough for our needs because every value we
// read is a static literal.

function findExportedConstInitializer(
  sourceFile: SourceFile,
  name: string
): Expression | undefined {
  for (const stmt of sourceFile.statements) {
    if (
      !isVariableStatement(stmt) ||
      !stmt.modifiers?.some(m => m.kind === SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    for (const decl of stmt.declarationList.declarations) {
      if (isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
        return decl.initializer;
      }
    }
  }
  return undefined;
}

// Strip surrounding `as Foo` / `<Foo>x` type assertions.
function unwrapTypeAssertion(expr: Expression): Expression {
  while (isAsExpression(expr) || isTypeAssertion(expr)) {
    expr = expr.expression;
  }
  return expr;
}

// Property key text from an Identifier or string literal name.
function propertyKeyName(prop: PropertyAssignment): string | undefined {
  if (isIdentifier(prop.name) || isStringLiteral(prop.name)) {
    return prop.name.text;
  }
  return undefined;
}

// === Source extractors ======================================================

function readPlatforms(api: API): PlatformEntry[] {
  using source = api.createSourceFileFromFile(PLATFORMS_PATH);
  const init = findExportedConstInitializer(source.sourceFile, 'platforms');
  if (!init || !isArrayLiteralExpression(init)) {
    throw new Error('platforms array not found in platforms.tsx');
  }
  const out: PlatformEntry[] = [];
  for (const element of init.elements) {
    if (!isObjectLiteralExpression(element)) {
      continue;
    }
    let id: string | undefined;
    let link = '';
    let deprecated = false;
    for (const prop of element.properties) {
      if (!isPropertyAssignment(prop)) {
        continue;
      }
      const key = propertyKeyName(prop);
      if (key === 'id' && isStringLiteral(prop.initializer)) {
        id = prop.initializer.text;
      } else if (key === 'link' && isStringLiteral(prop.initializer)) {
        link = prop.initializer.text;
      } else if (
        key === 'deprecated' &&
        prop.initializer.kind === SyntaxKind.TrueKeyword
      ) {
        deprecated = true;
      }
    }
    if (!id) {
      continue;
    }

    const canonical = NO_DOCS_TREE.has(id)
      ? null
      : (CANONICAL_OVERRIDES[id] ?? parseLink(link));
    out.push({
      id,
      deprecated,
      lang: canonical?.lang ?? null,
      guide: canonical?.guide ?? null,
    });
  }
  return out;
}

function readLegacyToggleableKeys(api: API): Set<string> {
  using source = api.createSourceFileFromFile(PSP_PATH);
  const init = findExportedConstInitializer(
    source.sourceFile,
    'platformProductAvailability'
  );
  if (!init) {
    throw new Error('platformProductAvailability not found in productSelection.tsx');
  }
  const obj = unwrapTypeAssertion(init);
  if (!isObjectLiteralExpression(obj)) {
    throw new Error('platformProductAvailability is not an object literal');
  }
  const keys = new Set<string>();
  for (const prop of obj.properties) {
    if (!isPropertyAssignment(prop)) {
      continue;
    }
    const key = propertyKeyName(prop);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

function readWithMetricsOnboarding(api: API): Set<string> {
  using source = api.createSourceFileFromFile(CATEGORIES_PATH);
  const init = findExportedConstInitializer(source.sourceFile, 'withMetricsOnboarding');
  if (!init || !isNewExpression(init)) {
    throw new Error(
      'withMetricsOnboarding new Set() not found in platformCategories.tsx'
    );
  }
  const arg = init.arguments?.[0];
  if (!arg || !isArrayLiteralExpression(arg)) {
    throw new Error('withMetricsOnboarding Set has no array argument');
  }
  const out = new Set<string>();
  for (const element of arg.elements) {
    if (isStringLiteral(element)) {
      out.add(element.text);
    }
  }
  return out;
}

interface Frontmatter {
  notSupported?: string[];
  supported?: string[];
}

function readFrontmatter(file: string): Frontmatter {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) {
    return {};
  }
  return (parseYaml(m[1]!) as Frontmatter) ?? {};
}

function findFeaturePage(lang: string, feature: string): string | null {
  const candidates = [
    path.join(DOCS_PLATFORMS_DIR, lang, 'common', feature, 'index.mdx'),
    path.join(DOCS_PLATFORMS_DIR, lang, feature, 'index.mdx'),
  ];
  return candidates.find(existsSync) ?? null;
}

function findGuideOverridePage(
  lang: string,
  guide: string,
  feature: string
): string | null {
  for (const dir of ['guides', 'integrations']) {
    const f = path.join(DOCS_PLATFORMS_DIR, lang, dir, guide, feature, 'index.mdx');
    if (existsSync(f)) {
      return f;
    }
  }
  return null;
}

// Mirror of sentry-docs/src/frontmatter.ts:isSupported.
function isSupported(fm: Frontmatter, lang: string, guide: string | null): boolean {
  const canonical = guide ? `${lang}.${guide}` : lang;
  if (Array.isArray(fm.supported) && fm.supported.length) {
    if (fm.supported.includes(canonical)) {
      return true;
    }
    if (!fm.supported.includes(lang)) {
      return false;
    }
  }
  if (Array.isArray(fm.notSupported)) {
    if (fm.notSupported.includes(canonical) || fm.notSupported.includes(lang)) {
      return false;
    }
  }
  return true;
}

// Returns true if any non-spec source file under
// `static/app/gettingStartedDocs/<platformId>/` references the Sentry wizard
// CLI. The map only carries platforms whose onboarding flow is wizard-driven
// (i.e. surfaces the wizard CLI in the install step); the consumer renders
// nothing for platforms that have neither a curated toggle entry nor a wizard.
function hasOnboardingWizard(platformId: string): boolean {
  const dir = path.join(GETTING_STARTED_DOCS_DIR, platformId);
  return globSync('*.{ts,tsx}', {cwd: dir, exclude: ['*.spec.{ts,tsx}']}).some(file =>
    WIZARD_PATTERN.test(readFileSync(path.join(dir, file), 'utf8'))
  );
}

function deriveProducts(
  platform: PlatformEntry,
  withMetricsOnboarding: Set<string>
): string[] {
  if (!platform.lang) {
    return [];
  }
  const products: string[] = [];
  for (const [product, feature] of Object.entries(FEATURES)) {
    // A guide-specific page takes precedence over the language-level page.
    const page =
      (platform.guide && findGuideOverridePage(platform.lang, platform.guide, feature)) ||
      findFeaturePage(platform.lang, feature);
    if (!page || !isSupported(readFrontmatter(page), platform.lang, platform.guide)) {
      continue;
    }
    if (product === 'METRICS' && !withMetricsOnboarding.has(platform.id)) {
      continue;
    }
    if (PRODUCT_EXCLUSIONS[platform.id]?.has(product)) {
      continue;
    }

    products.push(product);
  }
  return products;
}

function emit(map: Record<string, string[]>): string {
  const header = `// DO NOT EDIT — regenerate via \`pnpm gen:platform-info\`.
//
// Generated from sentry-docs frontmatter (\`docs/platforms/<lang>/[common/]<feature>/index.mdx\`).
// Drives the informational card variant on the SCM onboarding step for
// platforms whose onboarding is wizard-driven (i.e. the install step calls
// out to the \`@sentry/wizard\` CLI), since toggles aren't actionable in that
// flow but communicating which products apply still is.
//
// Scope filters applied during generation:
//   1. Platforms curated in \`platformProductAvailability\` are excluded — the
//      curated map is the source of truth for their toggles, and the consumer
//      (\`scmPlatformFeatures.tsx\`) routes between the two via
//      \`platform in platformProductAvailability\`.
//   2. Platforms whose \`gettingStartedDocs/<id>/\` files don't reference the
//      wizard CLI are excluded — without a wizard AND without curated
//      toggles, the consumer renders nothing on the SCM step.
//
// To extend scope, drop the corresponding filter in
// \`scripts/genPlatformProductInfo.ts\`.

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {PlatformKey} from 'sentry/types/platform';

`;

  const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];
  // Matches the formatter's output so regenerating doesn't leave a diff.
  lines.push(
    'export const PLATFORM_PRODUCT_INFO: Partial<',
    '  Record<PlatformKey, readonly ProductSolution[]>',
    '> = {'
  );
  for (const [platform, products] of entries) {
    const key = /^[a-zA-Z]\w*$/.test(platform) ? platform : `'${platform}'`;
    if (products.length === 0) {
      lines.push(`  ${key}: [],`);
      continue;
    }
    lines.push(`  ${key}: [`);
    for (const p of products) {
      lines.push(`    ProductSolution.${p},`);
    }
    lines.push('  ],');
  }
  lines.push('};');
  return header + lines.join('\n') + '\n';
}

function main() {
  using api = new API();
  const platforms = readPlatforms(api);
  const legacyKeys = readLegacyToggleableKeys(api);
  const withMetricsOnboarding = readWithMetricsOnboarding(api);

  const out: Record<string, string[]> = {};
  for (const platform of platforms) {
    // Skip platforms already covered by platformProductAvailability. The
    // consumer (scmPlatformFeatures.tsx) routes between the two maps via
    // `platform in platformProductAvailability`, so curated entries here
    // would be redundant.
    if (legacyKeys.has(platform.id)) {
      continue;
    }
    if (platform.deprecated) {
      continue;
    }
    if (platform.id === 'other') {
      continue;
    }
    if (!hasOnboardingWizard(platform.id)) {
      continue;
    }
    out[platform.id] = deriveProducts(platform, withMetricsOnboarding);
  }

  writeFileSync(OUTPUT_PATH, emit(out));
  const total = Object.keys(out).length;
  const withProducts = Object.values(out).filter(p => p.length > 0).length;
  console.log(
    `Wrote ${path.relative(SENTRY_ROOT, OUTPUT_PATH)} (${total} platforms, ${withProducts} with one or more products beyond Errors).`
  );
}

main();
