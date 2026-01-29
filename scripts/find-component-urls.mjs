#!/usr/bin/env node
/**
 * CLI tool to find all URLs where a component is used
 *
 * Usage:
 *   node scripts/find-component-urls.mjs <componentName> <filePath>
 *
 * Example:
 *   node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx
 *   node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar.tsx
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parse} from '@babel/parser';
import traverse from '@babel/traverse';
import {glob} from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.join(REPO_ROOT, 'static', 'app');
const ROUTES_FILE = path.join(APP_ROOT, 'router', 'routes.tsx');

// Cache to avoid re-parsing files
const fileCache = new Map();
const importGraphCache = new Map();

/**
 * Parse a TypeScript/TSX file and return its AST
 */
function parseFile(filePath) {
  if (fileCache.has(filePath)) {
    return fileCache.get(filePath);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    fileCache.set(filePath, ast);
    return ast;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract import paths from a file's AST
 * Returns array of imported module paths
 */
function extractImports(ast) {
  const imports = [];

  traverse.default(ast, {
    ImportDeclaration(path) {
      imports.push(path.node.source.value);
    },
    // Also handle dynamic imports: import('...')
    CallExpression(path) {
      if (
        path.node.callee.type === 'Import' &&
        path.node.arguments.length > 0 &&
        path.node.arguments[0].type === 'StringLiteral'
      ) {
        imports.push(path.node.arguments[0].value);
      }
    },
  });

  return imports;
}

/**
 * Resolve import path to absolute file path
 * Handles:
 * - Relative imports: './component', '../utils'
 * - Absolute imports: 'sentry/components/button'
 * - Path aliases: '@sentry/scraps/button'
 */
function resolveImportPath(importPath, fromFile) {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);

    // Try with common extensions
    for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  // Handle 'sentry/*' absolute imports
  if (importPath.startsWith('sentry/')) {
    const relativePath = importPath.replace(/^sentry\//, '');
    let resolved = path.join(APP_ROOT, relativePath);

    for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  // Handle '@sentry/scraps/*' alias (maps to components/core/*)
  if (importPath.startsWith('@sentry/scraps/')) {
    const relativePath = importPath.replace(/^@sentry\/scraps\//, 'components/core/');
    let resolved = path.join(APP_ROOT, relativePath);

    for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  // Ignore external packages
  return null;
}

/**
 * Build reverse dependency graph
 * Returns Map: {filePath: [files that import it]}
 */
function buildImportGraph() {
  if (importGraphCache.size > 0) {
    return importGraphCache;
  }

  console.log('Building import graph... (this may take a minute)');

  // Find all .tsx and .ts files
  const files = glob.sync('**/*.{tsx,ts}', {
    cwd: APP_ROOT,
    absolute: true,
    ignore: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/node_modules/**'],
  });

  const reverseGraph = new Map();

  let processed = 0;
  for (const file of files) {
    const ast = parseFile(file);
    if (!ast) continue;

    const imports = extractImports(ast);

    for (const importPath of imports) {
      const resolvedPath = resolveImportPath(importPath, file);
      if (resolvedPath) {
        if (!reverseGraph.has(resolvedPath)) {
          reverseGraph.set(resolvedPath, []);
        }
        reverseGraph.get(resolvedPath).push(file);
      }
    }

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`\rProcessed ${processed}/${files.length} files...`);
    }
  }

  console.log(`\n✓ Import graph built with ${reverseGraph.size} nodes`);

  // Cache the result
  for (const [key, value] of reverseGraph.entries()) {
    importGraphCache.set(key, value);
  }

  return reverseGraph;
}

/**
 * Parse routes.tsx to extract component → URL mappings
 * Returns Map: {componentPath: [urls]}
 *
 * This implementation traverses the route tree to build full URL paths
 */
function parseRoutes() {
  console.log('Parsing routes.tsx...');

  const ast = parseFile(ROUTES_FILE);
  if (!ast) {
    throw new Error('Failed to parse routes.tsx');
  }

  const routeMap = new Map();

  // Find route arrays and objects in the buildRoutes function
  traverse.default(ast, {
    VariableDeclarator(nodePath) {
      const {node} = nodePath;

      // Look for route definitions (arrays or objects with children)
      if (node.init && (node.init.type === 'ArrayExpression' || node.init.type === 'ObjectExpression')) {
        traverseRouteDefinition(node.init, '', routeMap);
      }
    },
  });

  // Convert Sets to Arrays
  const result = new Map();
  for (const [componentPath, urlSet] of routeMap.entries()) {
    result.set(componentPath, Array.from(urlSet));
  }

  console.log(`✓ Found ${result.size} route mappings`);
  return result;
}

/**
 * Recursively traverse route definitions to build full URL paths
 */
function traverseRouteDefinition(node, parentPath, routeMap, withOrgPath = false) {
  if (node.type === 'ArrayExpression') {
    // Array of routes
    for (const element of node.elements) {
      if (element) {
        traverseRouteDefinition(element, parentPath, routeMap, withOrgPath);
      }
    }
  } else if (node.type === 'ObjectExpression') {
    // Single route object
    let currentPath = parentPath;
    let componentPath = null;
    let children = null;
    let hasWithOrgPath = withOrgPath;
    let isIndex = false;

    // Extract properties from the route object
    for (const prop of node.properties) {
      if (prop.type !== 'ObjectProperty') continue;

      const keyName = prop.key.name || prop.key.value;

      if (keyName === 'path' && prop.value.type === 'StringLiteral') {
        let pathValue = prop.value.value;

        // Build full path
        if (pathValue.startsWith('/')) {
          currentPath = pathValue;
        } else {
          currentPath = parentPath + (parentPath.endsWith('/') ? '' : '/') + pathValue;
        }
      } else if (keyName === 'index' && prop.value.value === true) {
        isIndex = true;
        currentPath = parentPath || '/';
      } else if (keyName === 'withOrgPath' && prop.value.value === true) {
        hasWithOrgPath = true;
      } else if (keyName === 'component') {
        componentPath = extractComponentPath(prop.value);
      } else if (keyName === 'children') {
        children = prop.value;
      }
    }

    // Add organization path prefix if needed
    if (hasWithOrgPath && currentPath && !currentPath.includes(':orgId')) {
      currentPath = '/organizations/:orgId' + (currentPath.startsWith('/') ? currentPath : '/' + currentPath);
    }

    // Store the component → URL mapping
    if (componentPath && currentPath) {
      if (!routeMap.has(componentPath)) {
        routeMap.set(componentPath, new Set());
      }
      routeMap.get(componentPath).add(currentPath);
    }

    // Recursively process children
    if (children) {
      traverseRouteDefinition(children, currentPath || parentPath, routeMap, hasWithOrgPath);
    }
  } else if (node.type === 'CallExpression') {
    // Handle make(() => import(...)) directly
    const componentPath = extractComponentPath(node);
    if (componentPath && parentPath) {
      if (!routeMap.has(componentPath)) {
        routeMap.set(componentPath, new Set());
      }
      routeMap.get(componentPath).add(parentPath);
    }
  }
}

/**
 * Extract component path from make(() => import(...)) call
 */
function extractComponentPath(node) {
  if (
    node.type === 'CallExpression' &&
    node.callee.name === 'make' &&
    node.arguments.length > 0
  ) {
    const arrowFn = node.arguments[0];

    if (
      arrowFn.type === 'ArrowFunctionExpression' &&
      arrowFn.body.type === 'CallExpression' &&
      arrowFn.body.callee.type === 'Import' &&
      arrowFn.body.arguments.length > 0 &&
      arrowFn.body.arguments[0].type === 'StringLiteral'
    ) {
      return arrowFn.body.arguments[0].value;
    }
  }

  return null;
}

/**
 * Trace a component file to all URLs where it's used
 * Uses BFS to follow the import graph upward
 */
function traceComponentToUrls(componentFile, importGraph, routeMap, verbose = false) {
  console.log(`\nTracing component: ${path.relative(REPO_ROOT, componentFile)}`);

  const visited = new Set();
  const queue = [{file: componentFile, path: [componentFile]}];
  const pageComponents = new Set();
  const tracePaths = new Map(); // Store trace paths for verbose output

  // BFS through the import graph
  while (queue.length > 0) {
    const {file: currentFile, path: currentPath} = queue.shift();

    if (visited.has(currentFile)) {
      continue;
    }
    visited.add(currentFile);

    // Check if this file is a page component (exists in route map)
    const relativePath = path.relative(APP_ROOT, currentFile);
    const sentryPath = 'sentry/' + relativePath.replace(/\.(tsx|ts)$/, '');

    for (const [routePath, urls] of routeMap.entries()) {
      if (routePath === sentryPath || routePath.includes(sentryPath)) {
        pageComponents.add({file: currentFile, urls});

        // Store trace path for verbose output
        if (verbose && currentPath.length > 1) {
          for (const url of urls) {
            if (!tracePaths.has(url)) {
              tracePaths.set(url, []);
            }
            tracePaths.get(url).push(currentPath);
          }
        }
      }
    }

    // Add files that import this file to the queue
    const importers = importGraph.get(currentFile) || [];
    for (const importer of importers) {
      if (!visited.has(importer)) {
        queue.push({file: importer, path: [...currentPath, importer]});
      }
    }
  }

  console.log(`✓ Traced through ${visited.size} files`);
  console.log(`✓ Found ${pageComponents.size} page components`);

  return {pageComponents, tracePaths};
}

/**
 * Get default parameter substitutions
 */
function getDefaultSubstitutions() {
  return {
    orgId: 'sentry',
    projectId: 'javascript',
    groupId: 'JAVASCRIPT-1',
    dashboardId: '1',
    teamId: 'frontend',
    artifactId: 'abc123',
    headArtifactId: 'abc123',
    baseArtifactId: 'def456',
    eventId: 'a1b2c3d4e5f6',
    replaySlug: 'replay-abc123',
    integrationSlug: 'github',
    release: '1.0.0',
    id: '1',
  };
}

/**
 * Substitute URL parameters with actual values
 */
function substituteUrlParams(url, substitutions) {
  let result = url;
  for (const [param, value] of Object.entries(substitutions)) {
    result = result.replace(new RegExp(`:${param}\\??`, 'g'), value);
  }
  return result;
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const options = {
    verbose: false,
    showTrace: false,
    substitute: false,
    substitutions: {},
    filteredArgs: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--trace') {
      options.showTrace = true;
    } else if (arg === '--substitute' || arg === '-s') {
      options.substitute = true;
    } else if (arg === '--org') {
      options.substitutions.orgId = args[++i];
      options.substitute = true;
    } else if (arg === '--project') {
      options.substitutions.projectId = args[++i];
      options.substitute = true;
    } else if (arg === '--params') {
      // Parse --params orgId=sentry,projectId=javascript
      const paramString = args[++i];
      const pairs = paramString.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          options.substitutions[key.trim()] = value.trim();
        }
      }
      options.substitute = true;
    } else if (!arg.startsWith('-')) {
      options.filteredArgs.push(arg);
    }
  }

  return options;
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.filteredArgs.length < 2) {
    console.error('Usage: node find-component-urls.mjs [options] <componentName> <filePath>');
    console.error('');
    console.error('Options:');
    console.error('  --verbose, -v           Show detailed tracing information');
    console.error('  --trace                 Show example trace paths from component to URLs');
    console.error('  --substitute, -s        Substitute URL parameters with default values');
    console.error('  --org <name>            Set organization name (default: sentry)');
    console.error('  --project <name>        Set project name (default: javascript)');
    console.error('  --params <key=val,...>  Set custom parameter substitutions');
    console.error('');
    console.error('Examples:');
    console.error('  node find-component-urls.mjs Button static/app/components/core/button/button.tsx');
    console.error('  node find-component-urls.mjs --trace SearchBar static/app/components/searchBar/index.tsx');
    console.error('  node find-component-urls.mjs --substitute Button static/app/components/core/button/button.tsx');
    console.error('  node find-component-urls.mjs --org acme --project python Button static/app/components/core/button/button.tsx');
    console.error('  node find-component-urls.mjs --params orgId=acme,projectId=python Button static/app/components/core/button/button.tsx');
    process.exit(1);
  }

  const [componentName, filePath] = options.filteredArgs;

  // Resolve file path
  let absoluteFilePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(REPO_ROOT, filePath);

  // Check if file exists
  if (!fs.existsSync(absoluteFilePath)) {
    console.error(`Error: File not found: ${absoluteFilePath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Finding URLs for component: ${componentName}`);
  console.log(`📄 Source file: ${path.relative(REPO_ROOT, absoluteFilePath)}`);

  // Show substitution settings if enabled
  if (options.substitute) {
    const substitutions = {...getDefaultSubstitutions(), ...options.substitutions};
    console.log('\n🔄 Parameter substitutions enabled:');
    const displaySubs = Object.entries(substitutions)
      .filter(([_, value]) => value !== undefined)
      .slice(0, 5); // Show first 5
    for (const [key, value] of displaySubs) {
      console.log(`   :${key} → ${value}`);
    }
    if (Object.keys(substitutions).length > 5) {
      console.log(`   ... and ${Object.keys(substitutions).length - 5} more`);
    }
  }
  console.log('');

  // Build the import graph
  const importGraph = buildImportGraph();

  // Parse routes
  const routeMap = parseRoutes();

  // Trace component to URLs
  const {pageComponents, tracePaths} = traceComponentToUrls(
    absoluteFilePath,
    importGraph,
    routeMap,
    options.verbose || options.showTrace
  );

  // Display results
  if (pageComponents.size === 0) {
    console.log(`\n⚠️  No URLs found for ${componentName}`);
    console.log('This component may be:');
    console.log('  - Not used in any routed pages');
    console.log('  - Only used in non-routed components');
    console.log('  - A utility or helper component');
  } else {
    const allUrls = new Set();
    for (const {urls} of pageComponents) {
      urls.forEach(url => allUrls.add(url));
    }

    const sortedUrls = Array.from(allUrls).sort();

    // Apply substitutions if requested
    let displayUrls = sortedUrls;
    if (options.substitute) {
      const substitutions = {...getDefaultSubstitutions(), ...options.substitutions};
      displayUrls = sortedUrls.map(url => substituteUrlParams(url, substitutions));
    }

    console.log(`\n✅ Found ${componentName} in the following URLs:\n`);

    for (const url of displayUrls) {
      console.log(`  • ${url}`);
    }

    console.log(`\n📊 Total URLs: ${sortedUrls.length}`);

    // Show trace paths if requested
    if (options.showTrace && tracePaths.size > 0) {
      console.log('\n🔗 Example trace paths:\n');

      let count = 0;
      for (const [url, paths] of tracePaths) {
        if (count >= 3) break; // Show only first 3 examples

        // Apply substitution to trace URL if enabled
        const displayUrl = options.substitute
          ? substituteUrlParams(url, {...getDefaultSubstitutions(), ...options.substitutions})
          : url;

        console.log(`  ${displayUrl}`);

        // Show first trace path for this URL
        const tracePath = paths[0];
        for (let i = 0; i < tracePath.length; i++) {
          const file = tracePath[i];
          const relativePath = path.relative(REPO_ROOT, file);
          const indent = '    ' + '  '.repeat(i);
          const arrow = i > 0 ? '↳ ' : '  ';
          console.log(`${indent}${arrow}${relativePath}`);
        }

        if (paths.length > 1) {
          console.log(`    ... and ${paths.length - 1} other path(s)\n`);
        } else {
          console.log('');
        }

        count++;
      }
    }
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
