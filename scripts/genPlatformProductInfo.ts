'use strict';

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
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

import * as ts from 'typescript';
import {parse as parseYaml} from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SENTRY_ROOT = path.resolve(__dirname, '..');
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
  link: string;
}

// Map of toggleable products. Mirrors the FEATURE_DISPLAY_ORDER in
// scmPlatformFeatures.tsx, minus ERROR_MONITORING (always implicit) and
// METRICS (handled with the extra withMetricsOnboarding gate below).
const FEATURES: Record<string, string> = {
  LOGS: 'logs',
  SESSION_REPLAY: 'session-replay',
  PERFORMANCE_MONITORING: 'tracing',
  PROFILING: 'profiling',
  METRICS: 'metrics',
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
  if (!m) return null;
  return {lang: m[1]!, guide: m[2]};
}

// === AST helpers ============================================================
// We parse the source TS files (platforms.tsx, productSelection.tsx,
// platformCategories.tsx) with the TypeScript compiler API instead of
// importing the values directly: importing them would pull in the React
// runtime, browser globals, and webpack-style path aliases that don't resolve
// in plain Node. AST parsing is enough for our needs because every value we
// read is a static literal.

function parseTSFile(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TSX
  );
}

function findExportedConstInitializer(
  source: ts.SourceFile,
  name: string
): ts.Expression | undefined {
  for (const stmt of source.statements) {
    if (
      !ts.isVariableStatement(stmt) ||
      !stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
        return decl.initializer;
      }
    }
  }
  return undefined;
}

// Strip surrounding `as Foo` / `<Foo>x` type assertions.
function unwrapTypeAssertion(expr: ts.Expression): ts.Expression {
  while (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    expr = expr.expression;
  }
  return expr;
}

// Property key text from an Identifier or string literal name.
function propertyKeyName(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return undefined;
}

// === Source extractors ======================================================

function readPlatforms(): PlatformEntry[] {
  const source = parseTSFile(PLATFORMS_PATH);
  const init = findExportedConstInitializer(source, 'platforms');
  if (!init || !ts.isArrayLiteralExpression(init)) {
    throw new Error('platforms array not found in platforms.tsx');
  }
  const out: PlatformEntry[] = [];
  for (const element of init.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    let id: string | undefined;
    let link = '';
    let deprecated = false;
    for (const prop of element.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = propertyKeyName(prop);
      if (key === 'id' && ts.isStringLiteral(prop.initializer)) {
        id = prop.initializer.text;
      } else if (key === 'link' && ts.isStringLiteral(prop.initializer)) {
        link = prop.initializer.text;
      } else if (
        key === 'deprecated' &&
        prop.initializer.kind === ts.SyntaxKind.TrueKeyword
      ) {
        deprecated = true;
      }
    }
    if (!id) continue;

    let lang: string | null = null;
    let guide: string | null = null;
    const override = CANONICAL_OVERRIDES[id];
    if (override) {
      lang = override.lang;
      guide = override.guide ?? null;
    } else if (NO_DOCS_TREE.has(id)) {
      // leave lang null
    } else if (link) {
      const parsed = parseLink(link);
      if (parsed) {
        lang = parsed.lang;
        guide = parsed.guide ?? null;
      }
    }

    out.push({id, link, deprecated, lang, guide});
  }
  return out;
}

function readLegacyToggleableKeys(): Set<string> {
  const source = parseTSFile(PSP_PATH);
  const init = findExportedConstInitializer(source, 'platformProductAvailability');
  if (!init) {
    throw new Error('platformProductAvailability not found in productSelection.tsx');
  }
  const obj = unwrapTypeAssertion(init);
  if (!ts.isObjectLiteralExpression(obj)) {
    throw new Error('platformProductAvailability is not an object literal');
  }
  const keys = new Set<string>();
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyKeyName(prop);
    if (key) keys.add(key);
  }
  return keys;
}

function readWithMetricsOnboarding(): Set<string> {
  const source = parseTSFile(CATEGORIES_PATH);
  const init = findExportedConstInitializer(source, 'withMetricsOnboarding');
  if (!init || !ts.isNewExpression(init)) {
    throw new Error(
      'withMetricsOnboarding new Set() not found in platformCategories.tsx'
    );
  }
  const arg = init.arguments?.[0];
  if (!arg || !ts.isArrayLiteralExpression(arg)) {
    throw new Error('withMetricsOnboarding Set has no array argument');
  }
  const out = new Set<string>();
  for (const element of arg.elements) {
    if (ts.isStringLiteral(element)) out.add(element.text);
  }
  return out;
}

interface Frontmatter {
  notSupported?: string[];
  supported?: string[];
}

function readFrontmatter(file: string): Frontmatter | null {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
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
    if (existsSync(f)) return f;
  }
  return null;
}

// Mirror of sentry-docs/src/frontmatter.ts:isSupported.
function isSupported(
  fm: Frontmatter | null,
  lang: string,
  guide: string | null
): boolean {
  if (!fm) return false;
  const canonical = guide ? `${lang}.${guide}` : lang;
  if (Array.isArray(fm.supported) && fm.supported.length) {
    if (fm.supported.includes(canonical)) return true;
    if (!fm.supported.includes(lang)) return false;
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
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.spec.tsx') || entry.name.endsWith('.spec.ts')) continue;
    if (!entry.name.endsWith('.tsx') && !entry.name.endsWith('.ts')) continue;
    const content = readFileSync(path.join(dir, entry.name), 'utf8');
    if (WIZARD_PATTERN.test(content)) return true;
  }
  return false;
}

function deriveProducts(
  platform: PlatformEntry,
  withMetricsOnboarding: Set<string>
): string[] {
  if (!platform.lang) return [];
  const products: string[] = [];
  for (const [product, feature] of Object.entries(FEATURES)) {
    let supported: boolean | null = null;
    if (platform.guide) {
      const override = findGuideOverridePage(platform.lang, platform.guide, feature);
      if (override) {
        supported = isSupported(readFrontmatter(override), platform.lang, platform.guide);
      }
    }
    if (supported === null) {
      const page = findFeaturePage(platform.lang, feature);
      supported = page
        ? isSupported(readFrontmatter(page), platform.lang, platform.guide)
        : false;
    }

    if (!supported) continue;
    if (product === 'METRICS' && !withMetricsOnboarding.has(platform.id)) continue;

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
import type {PlatformKey} from 'sentry/types/project';

`;

  const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];
  lines.push(
    'export const PLATFORM_PRODUCT_INFO: Partial<Record<PlatformKey, readonly ProductSolution[]>> = {'
  );
  for (const [platform, products] of entries) {
    const key = /^[a-zA-Z]\w*$/.test(platform) ? platform : `'${platform}'`;
    if (products.length === 0) {
      lines.push(`  ${key}: [],`);
      continue;
    }
    lines.push(`  ${key}: [`);
    for (const p of products) lines.push(`    ProductSolution.${p},`);
    lines.push('  ],');
  }
  lines.push('};');
  return header + lines.join('\n') + '\n';
}

function main() {
  const platforms = readPlatforms();
  const legacyKeys = readLegacyToggleableKeys();
  const withMetricsOnboarding = readWithMetricsOnboarding();

  const out: Record<string, string[]> = {};
  for (const platform of platforms) {
    // Skip platforms already covered by platformProductAvailability. The
    // consumer (scmPlatformFeatures.tsx) routes between the two maps via
    // `platform in platformProductAvailability`, so curated entries here
    // would be redundant.
    if (legacyKeys.has(platform.id)) continue;
    if (platform.deprecated) continue;
    if (platform.id === 'other') continue;
    // Only include platforms whose onboarding flow is wizard-driven. The
    // consumer surfaces information cards for these platforms because the
    // wizard CLI handles configuration; toggles aren't actionable. Platforms
    // with neither a curated toggle entry nor a wizard render nothing on the
    // SCM step.
    if (!hasOnboardingWizard(platform.id)) continue;
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
