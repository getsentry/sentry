#!/usr/bin/env node
'use strict';

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as ts from 'typescript';

// Main execution
// analyze-styled.ts is a script that analyzes styled components in TypeScript React files.
// It can be invoked via node analyze-styled.ts and accepts the following options:

// Execute with: node --experimental-transform-types scripts/analyze-styled.ts

// -- <file>          : Analyze a specific .tsx file instead of searching directories
// -n <number>        : Show top N most styled components (default: 10)
// -c <components>    : Filter analysis to specific components (comma-separated)
// -l                 : Show file locations for styled components (requires -c)
// -debug             : Enable debug logging
// -g                 : Use glob pattern to analyze only a subset of files
// --out csv          : Output results in CSV format
// <directory>        : Directory to search for .tsx files (default: './static/app')

// Examples:
//   node --experimental-transform-types scripts/analyze-styled.ts -- ./path/to/file.tsx
//   node --experimental-transform-types scripts/analyze-styled.ts -n 20 -c div,span ./static/app
//   node --experimental-transform-types scripts/analyze-styled.ts -l -c div ./static/app
//   node --experimental-transform-types scripts/analyze-styled.ts -g 'static/app/components/core/**/*.tsx'
//   node --experimental-transform-types scripts/analyze-styled.ts --out csv ./static/app

class Logger {
  constructor(private debugEnabled: boolean) {}

  log(...args: any[]): void {
    console.log(...args);
  }

  debug(...args: any[]): void {
    if (this.debugEnabled) {
      console.log(...args);
    }
  }

  error(...args: any[]): void {
    console.error(...args);
  }

  fatal(...args: any[]): void {
    console.error(...args);
  }

  table(...args: any[]): void {
    console.table(...args);
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }
}

// Global logger instance, initialized with debug disabled
const logger = new Logger(false);

// Metadata collection interfaces
interface Metadata {
  analyzedFiles: number;
  gitBranch: string | null;
  gitCommit: string | null;
  searchDirectory: string;
  timestamp: string;
  totalFiles: number;
}

// Metadata collection functions
function getGitInfo(): {
  branch: string | null;
  commit: string | null;
  status: string | null;
} {
  try {
    const commit = child_process
      .execSync('git rev-parse HEAD', {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']})
      .trim();

    const branch = child_process
      .execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      .trim();

    const status = child_process
      .execSync('git status --porcelain', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      .trim();

    return {commit, branch, status: status || 'clean'};
  } catch (error) {
    logger.debug('❌ Error getting git info:', (error as Error).message);
    return {commit: null, branch: null, status: null};
  }
}

function collectMetadata(
  searchDir: string,
  totalFiles: number,
  analyzedFiles: number
): Metadata {
  const gitInfo = getGitInfo();

  return {
    timestamp: new Date().toISOString(),
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    totalFiles,
    analyzedFiles,
    searchDirectory: searchDir,
  };
}

function outputMetadata(metadata: Metadata): void {
  if (config.outputFormat === 'csv') {
    logger.log('=== METADATA ===');
    const metadataData = [
      {Key: 'Timestamp', Value: metadata.timestamp},
      {Key: 'GitCommit', Value: metadata.gitCommit || 'unknown'},
      {Key: 'GitBranch', Value: metadata.gitBranch || 'unknown'},
      {Key: 'TotalFiles', Value: metadata.totalFiles || 0},
      {Key: 'AnalyzedFiles', Value: metadata.analyzedFiles || 0},
    ];
    logger.log(arrayToCSV(metadataData));
    logger.log();
  } else {
    logger.log('\n📋 Analysis Metadata:\n');
    logger.log(`   • Timestamp: ${metadata.timestamp}`);
    logger.log(`   • Git Commit: ${metadata.gitCommit || 'unknown'}`);
    logger.log(`   • Git Branch: ${metadata.gitBranch || 'unknown'}`);
    logger.log(`   • Total Files: ${metadata.totalFiles || 0}`);
    logger.log(`   • Analyzed Files: ${metadata.analyzedFiles || 0}`);
  }
}

// Git history functions
interface GitCommit {
  date: string;
  hash: string;
  timestamp: number;
}

function getCommitsInDateRange(startDate: string, intervalDays: number): GitCommit[] {
  // Precompute interval dates to avoid processing too many commits
  const intervalDates: string[] = [];
  const start = new Date(startDate);
  const now = new Date();

  let currentDate = new Date(start);

  while (currentDate <= now) {
    intervalDates.push(currentDate.toISOString().split('T')[0]!);
    currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }

  logger.log(`Getting first commit for ${intervalDates.length} interval dates...`);

  const commits: GitCommit[] = [];

  // Get the first commit for each interval date
  for (const date of intervalDates) {
    try {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0]!;

      const output = child_process.execSync(
        `git log --since="${date}" --until="${nextDateStr}" --format="%H,%ct" --reverse -n 1`,
        {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}
      );

      const line = output.trim();
      if (line.length > 0) {
        const [hash, timestamp] = line.split(',');
        commits.push({
          hash: hash!,
          date,
          timestamp: parseInt(timestamp!, 10),
        });
      }
    } catch (error) {
      // Skip dates with no commits
      continue;
    }
  }

  return commits;
}

// CSV helper functions
function escapeCsvField(field: string | number): string {
  if (typeof field === 'number') return field.toString();
  if (field === null || field === undefined) return '';
  const fieldStr = field.toString();
  if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }
  return fieldStr;
}

function arrayToCSV(data: Array<Record<string, any>>): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0] ?? {});
  const csvHeaders = headers.map(escapeCsvField).join(',');

  const csvRows = data.map(row =>
    headers
      .map(header => {
        const value = row[header];
        return escapeCsvField(value !== null && value !== undefined ? value : '');
      })
      .join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}
interface Config {
  components: Set<string> | null;
  debug: boolean;
  interval: number;
  outdir: string;
  outputFormat: 'table' | 'csv';
  searchDir: string | null;
  showLocations: boolean;
  startDate: string | null;
  targetFile: string | null;
  topN: number;
  useGlob: boolean;
}

function parseArguments(args: string[]): Config {
  const config: Config = {
    debug: false,
    topN: 10,
    outputFormat: 'table',
    searchDir: null,
    targetFile: null,
    showLocations: false,
    useGlob: false,
    components: null,
    startDate: null,
    interval: 7,
    outdir: '/tmp/analyze-styled-output',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--' && i + 1 < args.length) {
      config.targetFile = args[i + 1] ?? null;
      break;
    } else if (args[i] === '-n' && i + 1 < args.length) {
      const nextArgV = args[i + 1];
      if (!nextArgV) {
        throw new Error('-n option requires a number argument');
      }
      const nValue = parseInt(nextArgV, 10);
      if (isNaN(nValue) || nValue <= 0) {
        throw new Error('-n option must be a positive number');
      }
      config.topN = nValue;
      i++;
    } else if (args[i] === '-c' && i + 1 < args.length) {
      config.components = config.components || new Set();
      const componentsArg = args[i + 1]?.split(',') ?? [];
      componentsArg.map(c => c.trim()).forEach(c => config.components!.add(c));
      i++;
    } else if (args[i] === '-l') {
      config.showLocations = true;
    } else if (args[i] === '-g') {
      config.useGlob = true;
    } else if (args[i] === '-debug') {
      config.debug = true;
    } else if (args[i] === '--out') {
      if (i + 1 >= args.length) {
        throw new Error(
          '--out option requires a format argument. Only "csv" is supported.'
        );
      }
      const format = args[i + 1];
      if (format === 'csv') {
        config.outputFormat = 'csv';
      } else {
        throw new Error(`Invalid output format: ${format}. Only 'csv' is supported.`);
      }
      i++;
    } else if (args[i] === '--start-date' && i + 1 < args.length) {
      config.startDate = args[i + 1] ?? null;
      i++;
    } else if (args[i] === '--interval' && i + 1 < args.length) {
      const intervalValue = parseInt(args[i + 1] ?? '7', 10);
      if (isNaN(intervalValue) || intervalValue <= 0) {
        throw new Error('--interval option must be a positive number');
      }
      config.interval = intervalValue;
      i++;
    } else if (args[i] === '--outdir' && i + 1 < args.length) {
      config.outdir = args[i + 1] ?? './history-output';
      i++;
    } else if (!config.searchDir) {
      config.searchDir = args[i] ?? null;
    }
  }

  return config;
}

function validateConfig(config: Config): void {
  if (config.showLocations && !config.components) {
    throw new Error(
      '-l option requires -c to specify components filter, otherwise it will analyze all styled components and produce a lot of output.'
    );
  }

  if (config.useGlob && !config.searchDir) {
    throw new Error('-g option requires a glob pattern argument');
  }

  // Default to './static/app' if no directory specified
  if (!config.searchDir && !config.targetFile) {
    config.searchDir = './static/app';
  }
}

function findTsxFiles(dir: string): string[] {
  try {
    const output = child_process.execSync(
      `rg --files --type-add 'tsx:*.tsx' --type tsx "${dir}"`,
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    return output
      .trim()
      .split('\n')
      .filter(file => file.length > 0);
  } catch (error) {
    logger.debug(
      `❌ Error running ripgrep: ${(error as Error).message}, falling back to fs`
    );
    // Fallback to original implementation if ripgrep fails or is missing
    const files = fs.readdirSync(dir);
    const results: string[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        results.push(...findTsxFiles(filePath));
      } else if (file.endsWith('.tsx')) {
        results.push(filePath);
      }
    }

    return results;
  }
}

function collectTsxFilesForCurrentState(c: Config): string[] {
  if (c.targetFile) {
    if (!fs.existsSync(c.targetFile)) {
      logger.debug(`❌ Target file not found: ${c.targetFile}`);
      return [];
    }
    if (!c.targetFile.endsWith('.tsx')) {
      logger.debug(`❌ Target file is not a .tsx file: ${c.targetFile}`);
      return [];
    }
    return [c.targetFile];
  }
  const searchDir = c.searchDir || './static/app';

  if (!fs.existsSync(searchDir)) {
    logger.debug(`❌ Search directory not found: ${searchDir}`);
    return [];
  }

  if (c.useGlob) {
    try {
      return fs.globSync(searchDir);
    } catch (error) {
      logger.debug(`❌ Error with glob pattern: ${(error as Error).message}`);
      return [];
    }
  } else {
    return findTsxFiles(searchDir);
  }
}

const config = parseArguments(process.argv.slice(2));
validateConfig(config);

// Update global logger with debug setting
logger.setDebugEnabled(config.debug);

// For non-historical analysis, collect files at startup
// For historical analysis, files will be collected per commit
let tsxFiles: string[] = [];

if (!config.startDate) {
  // Only collect files at startup for non-historical analysis
  tsxFiles = collectTsxFilesForCurrentState(config);

  // For non-historical analysis, exit if no files found
  if (tsxFiles.length === 0) {
    if (config.targetFile) {
      logger.fatal(`❌ File not found: ${config.targetFile}`);
    } else {
      logger.fatal(`❌ No .tsx files found in search directory`);
    }
    process.exit(1);
  }
}

// Detector configuration interfaces
interface DetectorContext {
  config: Config;
  fileName: string;
  sourceFile: ts.SourceFile;
}

abstract class BaseDetector {
  abstract name: string;
  abstract execute(node: ts.Node, context: DetectorContext): void;
  abstract results(): void;
  abstract reset(): void;
}

interface DetectorConfiguration {
  detectors: BaseDetector[];
}

// Detector classes

class CoreComponentImportsDetector extends BaseDetector {
  name = 'CoreComponents';
  private components = new Set<string>();
  private usage = new Map<string, {count: number; files: Set<string>}>();

  execute(node: ts.Node, context: DetectorContext): void {
    // Handle import declarations
    if (ts.isImportDeclaration(node)) {
      const importDecl = node;
      const moduleSpecifier = importDecl.moduleSpecifier;

      if (moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
        const moduleName = (moduleSpecifier as ts.StringLiteral).text;
        if (
          moduleName.includes('sentry/components/core') &&
          importDecl.importClause?.namedBindings
        ) {
          const namedBindings = importDecl.importClause.namedBindings;
          if (namedBindings.kind === ts.SyntaxKind.NamedImports) {
            const namedImports = namedBindings;
            namedImports.elements.forEach(element => {
              this.components.add(element.name.text);
            });
          }
        }
      }
    }

    // Handle JSX element usage
    if (ts.isJsxElement(node)) {
      const jsxElement = node;
      if (jsxElement.openingElement.tagName.kind === ts.SyntaxKind.Identifier) {
        const tagName = jsxElement.openingElement.tagName.text;

        if (this.components.has(tagName)) {
          const usage = this.usage.get(tagName);
          if (usage) {
            usage.files.add(context.fileName);
            usage.count++;
          } else {
            this.usage.set(tagName, {
              files: new Set([context.fileName]),
              count: 1,
            });
          }
        }
      }
    }
  }

  reset(): void {
    this.components.clear();
    this.usage.clear();
  }

  results(): void {
    if (this.usage.size === 0) {
      // Early return for empty usage - no computation needed
      if (config.outputFormat === 'csv') {
        logger.log('=== CORE COMPONENT USAGE (LAYOUT) ===');
        logger.log(arrayToCSV([{Type: 'Layout', Component: '', Instances: 0}]));
        logger.log();

        logger.log('=== CORE COMPONENT USAGE (TEXT) ===');
        logger.log(arrayToCSV([{Type: 'Text', Component: '', Instances: 0}]));
        logger.log();

        logger.log('=== CORE COMPONENT USAGE (ALL COMPONENTS) ===');
        logger.log(arrayToCSV([{Component: '', Instances: 0}]));
        logger.log();

        logger.log('=== CORE COMPONENT USAGE (SUMMARY) ===');
        logger.log(
          arrayToCSV([
            {Component: 'Total Files', Instances: 0},
            {Component: 'Core Components', Instances: 0},
          ])
        );
        logger.log();
      } else {
        logger.log('\n🧩 Core Component Usage (from sentry/components/core):');
        logger.log('No core component usage found.');
      }
      return;
    }

    // Parse and categorize components
    const layout = Array.from(this.usage.entries())
      .filter(
        ([component]) =>
          component.includes('Flex') ||
          component.includes('Grid') ||
          component.includes('Stack') ||
          component.includes('Container')
      )
      .sort((a, b) => b[1].count - a[1].count);

    const text = Array.from(this.usage.entries())
      .filter(
        ([component]) => component.includes('Text') || component.includes('Heading')
      )
      .sort((a, b) => b[1].count - a[1].count);

    // Prepare data structures for both output formats
    const layoutData = layout.map(([component, {count, files: _files}]) => ({
      Type: 'Layout',
      Component: component,
      Instances: count,
    }));

    const textData = text.map(([component, {count, files: _files}]) => ({
      Type: 'Text',
      Component: component,
      Instances: count,
    }));

    const totalCount = Array.from(this.usage.values()).reduce(
      (sum, {count}) => sum + count,
      0
    );

    // Prepare all components data sorted by usage
    const allComponentsData = Array.from(this.usage.entries())
      .map(([component, {count, files: _files}]) => ({
        Component: component,
        Instances: count,
      }))
      .sort((a, b) => b.Instances - a.Instances);

    if (config.outputFormat === 'csv') {
      // Always output layout section (with empty data if no results)
      logger.log('=== CORE COMPONENT USAGE (LAYOUT) ===');
      logger.log(
        arrayToCSV(
          layoutData.length > 0
            ? layoutData
            : [{Type: 'Layout', Component: '', Instances: 0}]
        )
      );
      logger.log();

      // Always output text section (with empty data if no results)
      logger.log('=== CORE COMPONENT USAGE (TEXT) ===');
      logger.log(
        arrayToCSV(
          textData.length > 0 ? textData : [{Type: 'Text', Component: '', Instances: 0}]
        )
      );
      logger.log();

      // Always output all components listing
      logger.log('=== CORE COMPONENT USAGE (ALL COMPONENTS) ===');
      logger.log(
        arrayToCSV(
          allComponentsData.length > 0
            ? allComponentsData
            : [{Component: '', Instances: 0}]
        )
      );
      logger.log();

      // Always output summary
      logger.log('=== CORE COMPONENT USAGE (SUMMARY) ===');
      logger.log(
        arrayToCSV([
          {Component: 'Total Files', Instances: tsxFiles.length || 0},
          {Component: 'Core Components', Instances: totalCount || 0},
        ])
      );
      logger.log();
    } else {
      logger.log('\n🧩 Core Component Usage (from sentry/components/core):\n');
      logger.table(layoutData);
      logger.table(textData);
      logger.log('\n📋 All Core Components:\n');
      logger.table(allComponentsData);
    }
  }
}

interface StyledComponent {
  component: string;
  componentType: 'intrinsic' | 'component' | 'unknown';
  cssRules: string;
  expressionCount: number;
  file: string;
  hasExpressions: boolean;
  location: {
    column: number;
    line: number;
  };
}
class StyledComponentsDetector extends BaseDetector {
  name = 'StyledComponents';
  private styledComponents: StyledComponent[] = [];
  private componentCounts = new Map<string, number>();
  private cssRuleCounts = new Map<string, number>();

  execute(node: ts.Node, context: DetectorContext): void {
    if (!ts.isTaggedTemplateExpression(node)) return;

    const taggedExpr = node;

    if (taggedExpr.tag.kind === ts.SyntaxKind.CallExpression) {
      const callExpr = taggedExpr.tag as ts.CallExpression;

      if (callExpr.expression.getText() === 'styled') {
        const component = callExpr.arguments[0];
        if (!component) return;

        let componentName = '';
        let componentType: 'intrinsic' | 'component' | 'unknown' = 'unknown';

        // Extract component name and type
        if (
          component.kind === ts.SyntaxKind.StringLiteral ||
          component.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
        ) {
          componentName = (component as ts.StringLiteral).text;
          componentType = 'intrinsic';
        } else if (component.kind === ts.SyntaxKind.Identifier) {
          componentName = (component as ts.Identifier).text;
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.PropertyAccessExpression) {
          componentName = component.getText();
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.ArrowFunction) {
          componentName = 'InlineArrowFunction';
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.AsExpression) {
          const asExpr = component as ts.AsExpression;
          componentName = asExpr.expression.getText();
          componentType = 'component';
        } else if (
          component.kind === ts.SyntaxKind.FunctionExpression ||
          component.kind === ts.SyntaxKind.CallExpression
        ) {
          componentName = 'InlineFunction';
          componentType = 'component';
        } else {
          logger.debug(
            'Debug: ',
            component.kind,
            'Text:',
            component.getText(),
            'File:',
            context.fileName
          );
        }

        const cssRules = taggedExpr.template.getText();
        const {line, character} = context.sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );

        const expressions =
          taggedExpr.template.kind === ts.SyntaxKind.TemplateExpression
            ? taggedExpr.template.templateSpans
            : [];
        const hasExpressions = expressions.length > 0;

        const shouldInclude =
          context.config.components === null ||
          context.config.components.has(componentName);

        if (shouldInclude) {
          const styledComponent: StyledComponent = {
            file: context.fileName,
            component: componentName,
            componentType,
            cssRules: cssRules.trim(),
            location: {
              line: line + 1,
              column: character + 1,
            },
            hasExpressions,
            expressionCount: expressions.length,
          };

          this.styledComponents.push(styledComponent);

          // Track component usage count
          const currentComponentCount = this.componentCounts.get(componentName) || 0;
          this.componentCounts.set(componentName, currentComponentCount + 1);

          // Track CSS rules usage count
          this.trackCssRules(cssRules.trim());
        }
      }
    }
  }

  reset(): void {
    this.styledComponents = [];
    this.componentCounts.clear();
    this.cssRuleCounts.clear();
  }

  private trackCssRules(cssRules: string): void {
    for (const line of cssRules.split('\n')) {
      if (
        line.match(/^\s*$/) ||
        line.trim() === '`' ||
        line.match(/^\s*}/) ||
        line.match(/^\s*\/\*.*\*\/\s*$/)
      ) {
        continue;
      }

      // Skip selectors and media queries for rule counting
      if (
        line.match(/^\s*[>&]/) ||
        line.match(/^\s*@media/) ||
        line.match(/^\s*@container/)
      ) {
        continue;
      }

      // Handle special expressions
      if (line.match(/^\s*\$\{p => p.theme.overflowEllipsis\};?/)) {
        const currentCount = this.cssRuleCounts.get('overflowEllipsis') || 0;
        this.cssRuleCounts.set('overflowEllipsis', currentCount + 1);
        continue;
      }

      // Parse CSS property:value pairs
      const [property] = line.split(':');
      const trimmedProperty = property?.trim();

      if (trimmedProperty && trimmedProperty.length > 0) {
        const currentCount = this.cssRuleCounts.get(trimmedProperty) || 0;
        this.cssRuleCounts.set(trimmedProperty, currentCount + 1);
      }
    }
  }

  results(): void {
    if (this.styledComponents.length === 0) {
      // Early return for empty results - no computation needed
      if (config.outputFormat === 'csv') {
        logger.log(`=== TOP ${config.topN} MOST COMMONLY STYLED COMPONENTS ===`);
        logger.log(arrayToCSV([{Component: '', Instances: 0}]));
        logger.log();

        logger.log(`=== TOP ${config.topN} MOST COMMONLY USED CSS RULES ===`);
        logger.log(arrayToCSV([{CSSRule: '', Instances: 0}]));
        logger.log();
      } else {
        logger.log('\n📊 Found 0 styled components.');
      }
      return;
    }

    // ==== COMPUTATION PHASE ====
    // Calculate statistics from analysis results
    let totalIntrinsic = 0;
    let totalReactComponents = 0;
    let unknownComponents = 0;
    let dynamicExpressions = 0;
    let staticExpressions = 0;

    this.styledComponents.forEach(sc => {
      if (sc.componentType === 'component') totalReactComponents++;
      else if (sc.componentType === 'intrinsic') totalIntrinsic++;
      else unknownComponents++;

      // Count expressions
      if (sc.hasExpressions) {
        dynamicExpressions += sc.expressionCount;
      } else {
        staticExpressions++;
      }
    });

    const totalStyledComponents = this.styledComponents.length;

    // Calculate expression statistics
    const avgDynamic =
      totalStyledComponents > 0
        ? (dynamicExpressions / totalStyledComponents).toFixed(2)
        : '0.00';
    const avgStatic =
      totalStyledComponents > 0
        ? (staticExpressions / totalStyledComponents).toFixed(2)
        : '0.00';
    const totalExpressions = dynamicExpressions + staticExpressions;
    const dynamicPerc =
      totalExpressions > 0
        ? ((dynamicExpressions / totalExpressions) * 100).toFixed(1)
        : '0.0';
    const staticPerc =
      totalExpressions > 0
        ? ((staticExpressions / totalExpressions) * 100).toFixed(1)
        : '0.0';

    // Prepare top components and CSS rules
    const topComponents = Array.from(this.componentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.topN);

    const topCssRules = Array.from(this.cssRuleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.topN);

    // Process styled info and parse errors
    const styledInfo: Record<
      string,
      Array<{
        count: number;
        expression: StyledComponent;
        location: string;
        ruleInfo: Record<string, RuleInfo[]>;
      }>
    > = {};

    type RuleInfo = {
      dynamic: number;
      value: string;
      children?: RuleInfo[];
    };

    const parseErrors: string[] = [];
    this.styledComponents.forEach(sc => {
      const count = (styledInfo[sc.component]?.length ?? 0) + 1;
      styledInfo[sc.component] = styledInfo[sc.component] || [];

      const ruleInfo: Record<string, RuleInfo[]> = {};

      for (const line of sc.cssRules.split('\n')) {
        if (
          line.match(/^\s*$/) ||
          line.trim() === '`' ||
          line.match(/^\s*}/) ||
          line.match(/^\s*\/\*.*\*\/\s*$/)
        ) {
          continue;
        }

        if (line.match(/^\s*[>&]/)) {
          const subSelector = line.match(/^\s*([>&])/)?.[1] || 'unknown sub selector';
          ruleInfo[subSelector] = ruleInfo[subSelector] || [];
          ruleInfo[subSelector].push({
            value: line,
            dynamic: 0,
          });
          continue;
        }

        if (line.match(/^\s*@media/) || line.match(/^\s*@container/)) {
          const mediaQuery = '@media';
          ruleInfo[mediaQuery] = ruleInfo[mediaQuery] || [];
          ruleInfo[mediaQuery].push({
            value: line,
            dynamic: 0,
          });
          continue;
        }

        if (line.match(/^\s*\$\{p => p.theme.overflowEllipsis\};?/)) {
          ruleInfo['@expression: p.theme.overflowEllipsis'] =
            ruleInfo['@expression: p.theme.overflowEllipsis'] || [];
          ruleInfo['@expression: p.theme.overflowEllipsis'].push({
            value: '${p => p.theme.overflowEllipsis}',
            dynamic: 1,
          });
          continue;
        }

        let [property, value] = line.split(':');
        property = property?.trim();
        value = value?.trim().replace(/;$/, '');

        if (property && value) {
          ruleInfo[property] = ruleInfo[property] || [];
          ruleInfo[property]!.push({
            value,
            dynamic: (value.match(/\$\{[^}]+\}/g) || []).length,
          });
        } else {
          ruleInfo[line] = ruleInfo[line] || [];
          ruleInfo[line].push({
            value: line,
            dynamic: 0,
          });
          logger.debug('❌ Error parsing line:\n', JSON.stringify(line, null, 2));
          parseErrors.push(`/////////////////\n${line}\n/////////////////\n`);
        }
      }

      styledInfo[sc.component]!.push({
        count,
        location: `${sc.file}:${sc.location.line}:${sc.location.column}`,
        expression: sc,
        ruleInfo,
      });
    });

    const errorCounts = new Map<string, {count: number}>();

    for (const error of parseErrors) {
      const existing = errorCounts.get(error);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(error, {
          count: 1,
        });
      }
    }

    // const deduplicatedErrors = Array.from(errorCounts.entries())
    //   .sort((a, b) => b[1].count - a[1].count)
    //   .map(([error, info]) => {
    //     return `// Error occurred ${info.count} time(s)\n${error}`;
    //   })
    //   .join('\n\n');

    // ==== LOGGING PHASE ====
    if (config.outputFormat === 'csv') {
      // Always output top components section
      logger.log(`=== TOP ${config.topN} MOST COMMONLY STYLED COMPONENTS ===`);
      const componentsData =
        topComponents.length > 0
          ? topComponents.map(([component, count]) => ({
              Component: component,
              Instances: count,
            }))
          : [{Component: '', Instances: 0}];
      logger.log(arrayToCSV(componentsData));
      logger.log();

      // Always output top CSS rules section
      logger.log(`=== TOP ${config.topN} MOST COMMONLY USED CSS RULES ===`);
      const cssRulesData =
        topCssRules.length > 0
          ? topCssRules.map(([rule, count]) => ({
              CSSRule: rule,
              Instances: count,
            }))
          : [{CSSRule: '', Instances: 0}];
      logger.log(arrayToCSV(cssRulesData));
      logger.log();
    } else {
      // Output summary
      logger.log(` \n📊 Found ${totalStyledComponents} styled components:\n`);
      logger.log(`   • Intrinsic elements (div, span, etc.): ${totalIntrinsic}`);
      logger.log(`   • React components: ${totalReactComponents}`);
      logger.log(`   • Unknown components: ${unknownComponents}`);
      logger.log(`   • Total files analyzed: ${tsxFiles.length}`);

      // Output expression statistics
      logger.log(' \n📄 Types of expressions:\n ');
      logger.log(`   • Dynamic expressions per styled component: ~${avgDynamic}`);
      logger.log(`   • Static expressions per styled component: ~${avgStatic}`);
      logger.log(`   • Total expressions: ${totalExpressions}`);
      logger.log(`   • Dynamic/Static ratio: ${dynamicPerc}% / ${staticPerc}%`);

      if (topComponents.length > 0) {
        logger.log(`\n🏆 Top ${config.topN} most commonly styled components:\n`);
        logger.table(
          topComponents.map(([component, count], index) => ({
            Rank: index + 1,
            Component: component,
            Instances: count,
          }))
        );
      }

      if (topCssRules.length > 0) {
        logger.log(`\n📏 Top ${config.topN} most commonly used CSS rules:\n`);
        logger.table(
          topCssRules.map(([rule, count], index) => ({
            Rank: index + 1,
            'CSS Rule': rule,
            Instances: count,
          }))
        );
      }
    }
  }
}

class StyledUsagePerFileDetector extends BaseDetector {
  name = 'StyledUsagePerFile';
  private fileStyledCounts = new Map<string, number>();
  private filesWithStyled = new Set<string>();
  private totalTsxFiles = new Set<string>();

  execute(node: ts.Node, context: DetectorContext): void {
    // Track all TSX files we analyze
    this.totalTsxFiles.add(context.fileName);

    if (!ts.isTaggedTemplateExpression(node)) return;

    const taggedExpr = node;

    if (taggedExpr.tag.kind === ts.SyntaxKind.CallExpression) {
      const callExpr = taggedExpr.tag as ts.CallExpression;

      if (callExpr.expression.getText() === 'styled') {
        const currentCount = this.fileStyledCounts.get(context.fileName) || 0;
        this.fileStyledCounts.set(context.fileName, currentCount + 1);
        this.filesWithStyled.add(context.fileName);
      }
    }
  }

  reset(): void {
    this.fileStyledCounts.clear();
    this.filesWithStyled.clear();
    this.totalTsxFiles.clear();
  }

  results(): void {
    const totalFiles = this.totalTsxFiles.size;
    const filesWithStyledCount = this.filesWithStyled.size;
    const percentageWithStyled =
      totalFiles > 0 ? ((filesWithStyledCount / totalFiles) * 100).toFixed(1) : '0.0';

    // Get top N files by styled call count
    const sortedFiles = Array.from(this.fileStyledCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.topN);

    if (config.outputFormat === 'csv') {
      // Files with most styled calls
      logger.log(`=== TOP ${config.topN} FILES BY STYLED CALL COUNT ===`);
      const filesData =
        sortedFiles.length > 0
          ? sortedFiles.map(([file, count]) => ({
              File: file,
              StyledCalls: count,
            }))
          : [{File: '', StyledCalls: 0}];
      logger.log(arrayToCSV(filesData));
      logger.log();

      // Summary statistics
      logger.log('=== STYLED USAGE STATISTICS ===');
      logger.log(
        arrayToCSV([
          {Metric: 'Total TSX Files', Value: totalFiles},
          {Metric: 'Files with Styled Calls', Value: filesWithStyledCount},
          {Metric: 'Percentage with Styled Calls', Value: `${percentageWithStyled}%`},
        ])
      );
      logger.log();
    } else {
      logger.log('\n📄 Styled Usage Per File:\n');

      if (sortedFiles.length > 0) {
        logger.log(`🏆 Top ${config.topN} files by styled call count:\n`);
        logger.table(
          sortedFiles.map(([file, count], index) => ({
            Rank: index + 1,
            File: file.replace(process.cwd() + '/', ''),
            'Styled Calls': count,
          }))
        );
      }

      logger.log('\n📊 Usage Statistics:\n');
      logger.log(`   • Total TSX files analyzed: ${totalFiles}`);
      logger.log(`   • Files containing styled calls: ${filesWithStyledCount}`);
      logger.log(
        `   • Percentage of TSX files with styled calls: ${percentageWithStyled}%`
      );
    }
  }
}

class FlexOnlyDivsDetector extends BaseDetector {
  name = 'FlexOnlyDivs';
  private styledComponents: StyledComponent[] = [];

  execute(node: ts.Node, context: DetectorContext): void {
    if (!ts.isTaggedTemplateExpression(node)) return;

    const taggedExpr = node;

    if (taggedExpr.tag.kind === ts.SyntaxKind.CallExpression) {
      const callExpr = taggedExpr.tag as ts.CallExpression;

      if (callExpr.expression.getText() === 'styled') {
        const component = callExpr.arguments[0];
        if (!component) return;

        let componentName = '';
        let componentType: 'intrinsic' | 'component' | 'unknown' = 'unknown';

        // Extract component name and type
        if (
          component.kind === ts.SyntaxKind.StringLiteral ||
          component.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
        ) {
          componentName = (component as ts.StringLiteral).text;
          componentType = 'intrinsic';
        } else if (component.kind === ts.SyntaxKind.Identifier) {
          componentName = (component as ts.Identifier).text;
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.PropertyAccessExpression) {
          componentName = component.getText();
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.ArrowFunction) {
          componentName = 'InlineArrowFunction';
          componentType = 'component';
        } else if (component.kind === ts.SyntaxKind.AsExpression) {
          const asExpr = component as ts.AsExpression;
          componentName = asExpr.expression.getText();
          componentType = 'component';
        } else if (
          component.kind === ts.SyntaxKind.FunctionExpression ||
          component.kind === ts.SyntaxKind.CallExpression
        ) {
          componentName = 'InlineFunction';
          componentType = 'component';
        }

        // Only process divs and respect component filter
        const shouldInclude =
          componentName === 'div' &&
          (context.config.components === null ||
            context.config.components.has(componentName));

        if (shouldInclude) {
          const cssRules = taggedExpr.template.getText();
          const {line, character} = context.sourceFile.getLineAndCharacterOfPosition(
            node.getStart()
          );

          const expressions =
            taggedExpr.template.kind === ts.SyntaxKind.TemplateExpression
              ? taggedExpr.template.templateSpans
              : [];

          const styledComponent: StyledComponent = {
            file: context.fileName,
            component: componentName,
            componentType,
            cssRules: cssRules.trim(),
            location: {
              line: line + 1,
              column: character + 1,
            },
            hasExpressions: expressions.length > 0,
            expressionCount: expressions.length,
          };

          this.styledComponents.push(styledComponent);
        }
      }
    }
  }

  reset(): void {
    this.styledComponents = [];
  }

  results(): void {
    // ==== COMPUTATION PHASE ====
    const flexRules = new Set([
      'flex',
      'flex-direction',
      'flex-wrap',
      'justify-content',
      'align-items',
      'align-content',
      'gap',
    ]);

    const flexOnlyComponents: Array<{component: string; location: string}> = [];

    for (const sc of this.styledComponents) {
      let hasOnlyFlexRules = true;
      let hasDisplayFlexRule = false;

      // Parse CSS rules to check if it only contains flex rules
      for (const line of sc.cssRules.split('\n')) {
        if (
          line.match(/^\s*$/) ||
          line.trim() === '`' ||
          line.match(/^\s*}/) ||
          line.match(/^\s*\/\*.*\*\/\s*$/) ||
          line.match(/^\s*[>&]/) ||
          line.match(/^\s*@media/) ||
          line.match(/^\s*@container/)
        ) {
          continue;
        }

        // Handle special expressions
        if (line.match(/^\s*\$\{p => p.theme.overflowEllipsis\};?/)) {
          // This is not a flex rule, so exclude this component
          hasOnlyFlexRules = false;
          break;
        }

        // Parse CSS property:value pairs
        const [property] = line.split(':');
        const trimmedProperty = property?.trim();

        if (trimmedProperty && trimmedProperty.length > 0) {
          if (trimmedProperty === 'display') {
            // Check if the value contains 'flex'
            const [, value] = line.split(':');
            const trimmedValue = value?.trim().replace(/;$/, '');
            if (trimmedValue === 'flex') {
              hasDisplayFlexRule = true;
            }
          } else if (!flexRules.has(trimmedProperty)) {
            hasOnlyFlexRules = false;
            break;
          }
        }
      }

      if (hasDisplayFlexRule && hasOnlyFlexRules) {
        flexOnlyComponents.push({
          location: `${sc.file}:${sc.location.line}:${sc.location.column}`,
          component: sc.component,
        });
      }
    }

    // Limit results to topN
    const results = flexOnlyComponents.slice(0, config.topN);

    // ==== LOGGING PHASE ====
    if (results.length === 0) {
      if (config.outputFormat === 'csv') {
        logger.log('=== STYLED DIVS WITH ONLY FLEX RULES ===');
        logger.log(arrayToCSV([{Rank: 0, Component: '', Location: ''}]));
        logger.log();
      } else {
        logger.log('\n🎯 Styled Divs with Only Flex Rules:');
        logger.log('No styled divs found that only use flexbox rules.');
      }
      return;
    }

    if (config.outputFormat === 'csv') {
      const csvData = results.map((result, index) => ({
        Rank: index + 1,
        Component: result.component,
        Location: result.location,
      }));
      logger.log('=== STYLED DIVS WITH ONLY FLEX RULES ===');
      logger.log(arrayToCSV(csvData));
      logger.log();
    } else {
      logger.log(`\n🎯 Top ${config.topN} Styled Divs with Only Flex Rules:\n`);
      logger.table(
        results.map((result, index) => ({
          '#': index + 1,
          Component: result.component,
          Location: result.location,
        }))
      );
    }
  }
}

function analyze(
  sourceFile: ts.SourceFile,
  fileName: string,
  detectorConfig: DetectorConfiguration
): void {
  const context: DetectorContext = {
    sourceFile,
    fileName,
    config,
  };

  function visit(node: ts.Node): void {
    // Run all detectors for every node
    for (const detector of detectorConfig.detectors) {
      detector.execute(node, context);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// History analysis functions
let interruptRequested = false;

interface CommitAnalysisResult {
  commit: GitCommit;
  filename: string;
  output: string;
}

function processCommit(
  commit: GitCommit,
  originalBranch: string
): CommitAnalysisResult | null {
  if (interruptRequested) {
    logger.log('🛑 Interrupt detected, skipping commit processing');
    return null;
  }

  // Clean any uncommitted changes before checkout
  // Use -f to force removal and -x to include ignored files
  child_process.execSync('git clean -d -f -x', {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Reset any staged changes
  child_process.execSync('git reset --hard', {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Checkout the commit (force checkout to handle conflicts)
  child_process.execSync(`git checkout -f ${commit.hash}`, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Check if analyze-styled.ts exists in this commit
  if (!fs.existsSync('scripts/analyze-styled.ts')) {
    logger.debug('Script not found in commit, copying from current version...');
    // Get the current script content and write it temporarily
    child_process.execSync(
      `git show ${originalBranch}:scripts/analyze-styled.ts > scripts/analyze-styled.ts`
    );
  }

  // Collect files for this specific commit
  const commitTsxFiles = collectTsxFilesForCurrentState(config);

  if (commitTsxFiles.length === 0) {
    logger.debug(
      `No .tsx files found in commit ${commit.hash.substring(0, 7)}, skipping analysis.`
    );
    return null;
  }

  logger.debug(
    `Found ${commitTsxFiles.length} .tsx files in commit ${commit.hash.substring(0, 7)}`
  );

  // Reset all detectors before analyzing this commit
  for (const detector of detectorConfig.detectors) {
    detector.reset();
  }

  // Capture the current stdout to save to file
  const originalLog = logger.log;
  const originalTable = logger.table;
  let output = '';

  logger.log = (...args: any[]) => {
    output += args.join(' ') + '\n';
  };
  logger.table = (...args: any[]) => {
    output += JSON.stringify(args[0], null, 2) + '\n';
  };

  // Run the analysis for this commit with commit-specific files
  runCurrentAnalysis(commitTsxFiles);

  // Restore original logging
  logger.log = originalLog;
  logger.table = originalTable;

  // Return analysis result instead of writing immediately
  const filename = `${commit.date}-${commit.hash.substring(0, 7)}.txt`;

  logger.log(`✅ Completed analysis for ${commit.hash.substring(0, 7)}`);

  return {
    commit,
    output,
    filename,
  };
}

function runHistoryAnalysis(c: Config) {
  // Reset interrupt flag
  interruptRequested = false;

  if (!c.startDate) {
    throw new Error('--start-date is required for historical analysis');
  }

  // Safety check: prevent running on dirty git tree
  const gitInfo = getGitInfo();
  if (gitInfo.status !== 'clean') {
    throw new Error(
      'Git tree is dirty. Please commit or stash your changes before running historical analysis.\n' +
        'This safety check prevents potential data loss during git operations.'
    );
  }

  // Ensure output directory exists
  if (!fs.existsSync(c.outdir)) {
    fs.mkdirSync(c.outdir, {recursive: true});
  }

  // Get current git state for restoration
  const originalBranch = child_process
    .execSync('git rev-parse --abbrev-ref HEAD', {encoding: 'utf8'})
    .trim();
  const hasUnstagedChanges =
    child_process.execSync('git status --porcelain', {encoding: 'utf8'}).trim().length >
    0;

  // Set up cleanup function for process interrupts

  // Set up interrupt handlers that set flag instead of immediately exiting
  const handleInterrupt = (_signal: string) => {
    // Set flag first, before any other operations
    interruptRequested = true;

    logger.log('\n⚠️  Process interrupted, cleaning up...');
    try {
      // Clean any uncommitted changes (including ignored files)
      child_process.execSync('git clean -d -f -x', {stdio: ['pipe', 'pipe', 'pipe']});
      // Reset any staged changes
      child_process.execSync('git reset --hard', {stdio: ['pipe', 'pipe', 'pipe']});
      // Force checkout to restore original branch
      child_process.execSync(`git checkout -f ${originalBranch}`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Restore stashed changes if any existed
      if (hasUnstagedChanges) {
        child_process.execSync('git stash pop', {stdio: ['pipe', 'pipe', 'pipe']});
      }
      logger.log('✅ Cleanup completed, restored to original state');
    } catch (error) {
      logger.fatal('❌ Error during cleanup:', (error as Error).message);
    }
    process.exit(0);
  };

  // Register interrupt handlers with signal names
  process.on('SIGINT', () => handleInterrupt('SIGINT'));
  process.on('SIGTERM', () => handleInterrupt('SIGTERM'));
  process.on('SIGUSR1', () => handleInterrupt('SIGUSR1'));
  process.on('SIGUSR2', () => handleInterrupt('SIGUSR2'));

  // Collect all analysis results in memory
  const analysisResults: CommitAnalysisResult[] = [];

  try {
    // Stash changes if any exist
    if (hasUnstagedChanges) {
      child_process.execSync('git stash push -m "analyze-styled temporary stash"', {
        stdio: 'inherit',
      });
    }
    const commits = getCommitsInDateRange(c.startDate, c.interval);

    logger.log(`Analyzing ${commits.length} commits at ${c.interval}-day intervals`);

    for (let i = 0; i < commits.length; i++) {
      // Check for interrupt before processing each commit
      if (interruptRequested) {
        logger.log(`\n⚠️  Interrupt received, stopping after ${i} commits processed.`);
        break;
      }

      const commit = commits[i]!;
      logger.log(
        `\n[${i + 1}/${commits.length}] Processing commit ${commit.hash.substring(0, 7)} (${commit.date})`
      );

      try {
        const result = processCommit(commit, originalBranch);
        if (result) {
          analysisResults.push(result);
        }
      } catch (error) {
        logger.error(
          `❌ Error processing commit ${commit.hash.substring(0, 7)}: ${(error as Error).message}`
        );
        continue;
      }
    }
  } finally {
    // Remove interrupt handlers
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGUSR1');
    process.removeAllListeners('SIGUSR2');

    // Restore original state
    try {
      // Clean any uncommitted changes before final checkout (including ignored files)
      child_process.execSync('git clean -d -f -x', {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Reset any staged changes
      child_process.execSync('git reset --hard', {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Force checkout to restore original branch
      child_process.execSync(`git checkout -f ${originalBranch}`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Restore stashed changes if any existed
      if (hasUnstagedChanges) {
        child_process.execSync('git stash pop', {stdio: ['pipe', 'pipe', 'pipe']});
      }
    } catch (error) {
      logger.fatal('❌ Error restoring git state:', (error as Error).message);
    }

    // Write all analysis results to files after git state is restored
    if (analysisResults.length > 0) {
      logger.log(`\n📝 Writing ${analysisResults.length} analysis files...`);

      // Ensure output directory exists
      if (!fs.existsSync(c.outdir)) {
        fs.mkdirSync(c.outdir, {recursive: true});
      }

      for (const result of analysisResults) {
        try {
          const filepath = path.join(c.outdir, result.filename);
          fs.writeFileSync(filepath, result.output);
          logger.log(`✅ Saved analysis to ${result.filename}`);
        } catch (error) {
          logger.error(
            `❌ Error writing ${result.filename}: ${(error as Error).message}`
          );
        }
      }
    }
  }

  logger.log(`\n🎉 Historical analysis complete! Results saved in ${config.outdir}`);
}

function runCurrentAnalysis(filesToAnalyze?: string[]) {
  // Use provided files or fall back to global tsxFiles
  const files = filesToAnalyze || tsxFiles;

  let successfullyAnalyzedFiles = 0;
  // Process all files with detectors
  for (const file of files) {
    try {
      const sourceCode = fs.readFileSync(file, 'utf8');
      const sourceFile = ts.createSourceFile(
        file,
        sourceCode,
        ts.ScriptTarget?.Latest,
        true
      );

      analyze(sourceFile, file, detectorConfig);
      successfullyAnalyzedFiles++;
    } catch (error) {
      logger.fatal(`❌ Error parsing ${file}:`, (error as Error).message);
    }
  }

  // Collect and output metadata first (for CSV format)
  const searchDirectory = config.searchDir || config.targetFile || './static/app';
  const metadata = collectMetadata(
    searchDirectory,
    files.length,
    successfullyAnalyzedFiles
  );
  outputMetadata(metadata);

  // Execute detector results
  for (const detector of detectorConfig.detectors) {
    detector.results();
  }
}

// Create detector configuration
const detectorConfig: DetectorConfiguration = {
  detectors: [
    new StyledComponentsDetector(),
    new CoreComponentImportsDetector(),
    new FlexOnlyDivsDetector(),
    new StyledUsagePerFileDetector(),
  ],
};

// Setup graceful exit handler for main analysis
function setupGracefulExit(): void {
  const cleanup = () => {
    logger.log('\n⚠️  Process interrupted, exiting gracefully...');
    process.exit(0);
  };

  // Register interrupt handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGUSR1', cleanup);
  process.on('SIGUSR2', cleanup);
}

// Main execution: check if historical analysis is requested
if (config.startDate) {
  runHistoryAnalysis(config);
} else {
  setupGracefulExit();
  runCurrentAnalysis();
}
