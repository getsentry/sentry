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
  outputFormat: 'table' | 'csv';
  searchDir: string | null;
  showLocations: boolean;
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

const config = parseArguments(process.argv.slice(2));
validateConfig(config);

// Update global logger with debug setting
logger.setDebugEnabled(config.debug);

let tsxFiles: string[] = [];

if (config.targetFile) {
  if (!fs.existsSync(config.targetFile)) {
    logger.fatal(`❌ File not found: ${config.targetFile}`);
    process.exit(1);
  }
  if (!config.targetFile.endsWith('.tsx')) {
    logger.fatal(`❌ File must be a .tsx file: ${config.targetFile}`);
    process.exit(1);
  }
  tsxFiles = [config.targetFile];
  logger.log(`🔍 Analyzing single file: ${config.targetFile}\n`);
} else {
  if (config.useGlob) {
    tsxFiles = fs.globSync(config.searchDir!);
  } else {
    tsxFiles = findTsxFiles(config.searchDir!);
  }
  logger.log(`🔍 Analyzing ${tsxFiles.length} .tsx files for styled components...\n`);
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

  results(): void {
    if (this.usage.size === 0) {
      // Early return for empty usage - no computation needed
      if (config.outputFormat !== 'csv') {
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
      Component: component,
      Instances: count,
      Type: 'Layout',
    }));

    const textData = text.map(([component, {count, files: _files}]) => ({
      Component: component,
      Instances: count,
      Type: 'Text',
    }));

    if (config.outputFormat === 'csv') {
      if (layout.length > 0) {
        logger.log('=== CORE COMPONENT USAGE (LAYOUT) ===');
        logger.log(arrayToCSV(layoutData));
        logger.log();
      }

      if (text.length > 0) {
        logger.log('=== CORE COMPONENT USAGE (TEXT) ===');
        logger.log(arrayToCSV(textData));
        logger.log();
      }
    } else {
      logger.log('\n🧩 Core Component Usage (from sentry/components/core):\n');
      logger.table(layoutData);
      logger.table(textData);
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
    if (config.outputFormat === 'csv') {
      // CSV output for statistics
      const topComponents = Array.from(this.componentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, config.topN);

      const topCssRules = Array.from(this.cssRuleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, config.topN);

      if (topComponents.length > 0) {
        logger.log(`=== TOP ${config.topN} MOST COMMONLY STYLED COMPONENTS ===`);
        const componentsData = topComponents.map(([component, count], index) => ({
          Rank: index + 1,
          Component: component,
          Instances: count,
        }));
        logger.log(arrayToCSV(componentsData));
        logger.log();
      }

      if (topCssRules.length > 0) {
        logger.log(`=== TOP ${config.topN} MOST COMMONLY USED CSS RULES ===`);
        const cssRulesData = topCssRules.map(([rule, count], index) => ({
          Rank: index + 1,
          CSSRule: rule,
          Instances: count,
        }));
        logger.log(arrayToCSV(cssRulesData));
        logger.log();
      }
    } else {
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

      // Output summary
      logger.log(` \n📊 Found ${totalStyledComponents} styled components:\n`);
      logger.log(`   • Intrinsic elements (div, span, etc.): ${totalIntrinsic}`);
      logger.log(`   • React components: ${totalReactComponents}`);
      logger.log(`   • Unknown components: ${unknownComponents}`);
      logger.log(`   • Total files analyzed: ${tsxFiles.length}`);

      // Output expression statistics
      logger.log(' \n📄 Types of expressions:\n ');
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

      logger.log(`   • Dynamic expressions per styled component: ~${avgDynamic}`);
      logger.log(`   • Static expressions per styled component: ~${avgStatic}`);
      logger.log(`   • Total expressions: ${totalExpressions}`);
      logger.log(`   • Dynamic/Static ratio: ${dynamicPerc}% / ${staticPerc}%`);

      // Output most commonly styled components and CSS rules
      const topComponents = Array.from(this.componentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, config.topN);

      const topCssRules = Array.from(this.cssRuleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, config.topN);

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

        // Deduplicate errors and track counts
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

      // Write deduplicated errors with headers to file
      const deduplicatedErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .map(([error, info]) => {
          return `// Error occurred ${info.count} time(s)\n${error}`;
        })
        .join('\n\n');

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
        logger.table(topComponents);
      }

      if (topCssRules.length > 0) {
        logger.log(`\n📏 Top ${config.topN} most commonly used CSS rules:\n`);
        logger.table(topCssRules);
      }

      if (deduplicatedErrors.length > 0) {
        logger.debug(`📄 Deduplicated errors:\n`);
        logger.debug(deduplicatedErrors);
      }
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
      if (config.outputFormat !== 'csv') {
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

// Create detector configuration
const detectorConfig: DetectorConfiguration = {
  detectors: [
    new StyledComponentsDetector(),
    new CoreComponentImportsDetector(),
    new FlexOnlyDivsDetector(),
  ],
};

// Process all files with detectors
for (const file of tsxFiles) {
  try {
    const sourceCode = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    analyze(sourceFile, file, detectorConfig);
  } catch (error) {
    logger.fatal(`❌ Error parsing ${file}:`, (error as Error).message);
  }
}

// Execute detector results
for (const detector of detectorConfig.detectors) {
  detector.results();
}
