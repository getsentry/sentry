#!/usr/bin/env node
'use strict';

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as ts from 'typescript';

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

  fatal(...args: any[]): void {
    console.error(...args);
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }
}

// Global logger instance, initialized with debug disabled
const logger = new Logger(false);

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
//   node analyze-styled.ts -- ./path/to/file.tsx
//   node analyze-styled.ts -n 20 -c div,span ./static/app
//   node analyze-styled.ts -l -c div ./static/app
//   node analyze-styled.ts -g 'static/app/components/core/**/*.tsx'
//   node analyze-styled.ts --out csv ./static/app
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
    } else if (args[i] === '--out' && i + 1 < args.length) {
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

try {
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

  // Detector configuration interfaces
  interface DetectorContext {
    config: Config;
    fileName: string;
    sourceFile: ts.SourceFile;
  }

  type DetectorFunction = (
    node: ts.Node,
    context: DetectorContext,
    state: AnalysisState
  ) => void;

  interface DetectorConfiguration {
    detectors: Map<ts.SyntaxKind, DetectorFunction[]>;
  }

  // Shared state for detectors
  interface AnalysisState {
    coreComponentUsage: Map<string, {count: number; files: Set<string>}>;
    styledComponents: StyledComponent[];
    totalStyledComponents: number;
  }

  // Detector functions

  // Track core component imports across files (shared state)
  const globalCoreComponents = new Set<string>();
  const detectCoreComponentImports: DetectorFunction = (node, _context, _state) => {
    const importDecl = node as ts.ImportDeclaration;
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
            globalCoreComponents.add(element.name.text);
          });
        }
      }
    }
  };

  const detectCoreComponentUsage: DetectorFunction = (node, context, state) => {
    const jsxElement = node as ts.JsxElement;
    if (jsxElement.openingElement.tagName.kind === ts.SyntaxKind.Identifier) {
      const tagName = jsxElement.openingElement.tagName.text;

      if (globalCoreComponents.has(tagName)) {
        const usage = state.coreComponentUsage.get(tagName);
        if (usage) {
          usage.files.add(context.fileName);
          usage.count++;
        } else {
          state.coreComponentUsage.set(tagName, {
            files: new Set([context.fileName]),
            count: 1,
          });
        }
      }
    }
  };

  const detectStyledComponents: DetectorFunction = (node, context, state) => {
    const taggedExpr = node as ts.TaggedTemplateExpression;

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

        // Always increment total count
        state.totalStyledComponents++;

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

          state.styledComponents.push(styledComponent);
        }
      }
    }
  };

  function analyze(
    sourceFile: ts.SourceFile,
    fileName: string,
    detectorConfig: DetectorConfiguration,
    _config: Config,
    state: AnalysisState
  ): void {
    const context: DetectorContext = {
      sourceFile,
      fileName,
      config,
    };

    function visit(node: ts.Node): void {
      // Run detectors that match this node type
      const detectors = detectorConfig.detectors.get(node.kind);
      if (detectors) {
        for (const detector of detectors) {
          detector(node, context, state);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  // Create detector configuration
  const detectorConfig: DetectorConfiguration = {
    detectors: new Map([
      [ts.SyntaxKind.ImportDeclaration, [detectCoreComponentImports]],
      [ts.SyntaxKind.JsxElement, [detectCoreComponentUsage]],
      [ts.SyntaxKind.TaggedTemplateExpression, [detectStyledComponents]],
    ]),
  };

  const analysisState: AnalysisState = {
    styledComponents: [],
    coreComponentUsage: new Map(),
    totalStyledComponents: 0,
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

      analyze(sourceFile, file, detectorConfig, config, analysisState);
    } catch (error) {
      logger.fatal(`❌ Error parsing ${file}:`, (error as Error).message);
    }
  }

  // Calculate statistics from analysis results
  let totalIntrinsic = 0;
  let totalReactComponents = 0;
  let unknownComponents = 0;
  let dynamicExpressions = 0;
  let staticExpressions = 0;

  analysisState.styledComponents.forEach(sc => {
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

  // Use results from analysis state
  const styledComponents = analysisState.styledComponents;
  const coreComponentUsage = analysisState.coreComponentUsage;
  const totalStyledComponents = analysisState.totalStyledComponents;

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

    const headers = Object.keys(data[0]);
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

  styledComponents.forEach(sc => {
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

  if (deduplicatedErrors.length > 0) {
    logger.debug(`📄 Deduplicated errors:\n`);
    logger.debug(deduplicatedErrors);
  }

  if (config.outputFormat === 'csv') {
    // CSV output
    const summaryData = [
      {
        Metric: 'Total Styled Components',
        Value: totalStyledComponents,
      },
      {
        Metric: 'Intrinsic Elements',
        Value: totalIntrinsic || 0,
      },
      {
        Metric: 'React Components',
        Value: totalReactComponents || 0,
      },
      {
        Metric: 'Unknown Components',
        Value: unknownComponents || 0,
      },
      {
        Metric: 'Total Files Analyzed',
        Value: tsxFiles.length,
      },
      {
        Metric: 'Dynamic Expressions Per Component',
        Value: (dynamicExpressions / totalStyledComponents).toFixed(2),
      },
      {
        Metric: 'Static Expressions Per Component',
        Value: (staticExpressions / totalStyledComponents).toFixed(2),
      },
      {
        Metric: 'Total Expressions',
        Value: (dynamicExpressions || 0) + (staticExpressions || 0),
      },
      {
        Metric: 'Dynamic Expression Percentage',
        Value:
          (dynamicExpressions || 0) + (staticExpressions || 0) > 0
            ? `${(((dynamicExpressions || 0) / ((dynamicExpressions || 0) + (staticExpressions || 0))) * 100).toFixed(1)}%`
            : '0%',
      },
      {
        Metric: 'Static Expression Percentage',
        Value:
          (dynamicExpressions || 0) + (staticExpressions || 0) > 0
            ? `${(((staticExpressions || 0) / ((dynamicExpressions || 0) + (staticExpressions || 0))) * 100).toFixed(1)}%`
            : '0%',
      },
    ];

    console.log('=== SUMMARY ===');
    console.log(arrayToCSV(summaryData));
    console.log();

    const topComponentsData = Object.entries(styledInfo)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, config.topN)
      .map(([component, info]) => {
        const pct = (info.length / totalStyledComponents) * 100;
        return {
          Component: component,
          'Styled Components': info.length,
          '% of Total': pct < 1 ? '<1%' : `${pct.toFixed(1)}%`,
        };
      });

    console.log('=== TOP COMPONENTS ===');
    console.log(arrayToCSV(topComponentsData));
    console.log();
  } else {
    logger.log(' ');
    // Output results
    logger.log(`📊 Found ${totalStyledComponents} styled components:\n`);
    logger.log(`   • Intrinsic elements (div, span, etc.): ${totalIntrinsic}`);
    logger.log(`   • React components: ${totalReactComponents}`);
    logger.log(`   • Unknown components: ${unknownComponents}`);
    logger.log(`   • Total files analyzed: ${tsxFiles.length}`);

    logger.log(` `);
    logger.log(`📄 Types of expressions:`);
    logger.log(` `);
    logger.log(
      `   • Dynamic expressions per styled component: ~${(dynamicExpressions / totalStyledComponents).toFixed(2)}`
    );
    logger.log(
      `   • Static expressions per styled component: ~${(staticExpressions / totalStyledComponents).toFixed(2)}`
    );
    const totalExpressions = (dynamicExpressions || 0) + (staticExpressions || 0);
    const dynamicRatio =
      totalExpressions > 0 ? (dynamicExpressions || 0) / totalExpressions : 0;
    const staticRatio =
      totalExpressions > 0 ? (staticExpressions || 0) / totalExpressions : 0;

    logger.log(`   • Total expressions: ${totalExpressions}`);
    logger.log(
      `   • Dynamic/Static ratio: ${(dynamicRatio * 100).toFixed(1)}% / ${(staticRatio * 100).toFixed(1)}%`
    );

    logger.log(' ');

    logger.log(`📂 Top ${config.topN} most styled components:\n`);
    console.table(
      Object.entries(styledInfo)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, config.topN)

        .map(([component, info]) => {
          const pct = (info.length / totalStyledComponents) * 100;
          return {
            Component: component,
            'Styled Components': info.length,
            '% of Total': pct < 1 ? '<1%' : `${pct.toFixed(1)}%`,
          };
        })
    );
  }

  if (config.showLocations) {
    if (config.outputFormat === 'csv') {
      const locationsData: Array<{Component: string; Location: string}> = [];
      for (const [component, info] of Object.entries(styledInfo)) {
        info.forEach(n => {
          locationsData.push({
            Component: component,
            Location: n.location,
          });
        });
      }
      console.log('=== LOCATIONS ===');
      console.log(arrayToCSV(locationsData));
      console.log();
    } else {
      logger.log('\n📍 Locations of styled components:\n');
      for (const [component, info] of Object.entries(styledInfo)) {
        logger.log(` ${component}:\n  • ${info.map(n => n.location).join('\n  • ')}`);
      }
    }
  }

  const commonRules: Record<string, number> = {};

  for (const [_, info] of Object.entries(styledInfo)) {
    for (const rule of info) {
      for (const [property, value] of Object.entries(rule.ruleInfo)) {
        commonRules[property] = (commonRules[property] || 0) + value.length;
      }
    }
  }

  if (config.outputFormat === 'csv') {
    const commonRulesData = Object.entries(commonRules)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.topN)
      .map(([property, count]) => ({
        Property: property,
        Count: count,
        '% of Total': ((count / totalStyledComponents) * 100).toFixed(2) + '%',
      }));

    console.log('=== COMMON RULES ===');
    console.log(arrayToCSV(commonRulesData));
    console.log();
  } else {
    console.table(
      Object.entries(commonRules)
        .sort((a, b) => b[1] - a[1])
        .slice(0, config.topN)
        .map(([property, count]) => ({
          Property: property,
          Count: count,
          '% of Total': ((count / totalStyledComponents) * 100).toFixed(2) + '%',
        }))
    );
  }

  // Output core component usage
  if (coreComponentUsage.size > 0) {
    if (config.outputFormat === 'csv') {
      const layout = Array.from(coreComponentUsage.entries())
        .filter(
          ([component]) =>
            component.includes('Flex') ||
            component.includes('Grid') ||
            component.includes('Stack') ||
            component.includes('Container')
        )
        .sort((a, b) => b[1].count - a[1].count);

      const text = Array.from(coreComponentUsage.entries())
        .filter(
          ([component]) => component.includes('Text') || component.includes('Heading')
        )
        .sort((a, b) => b[1].count - a[1].count);

      if (layout.length > 0) {
        const layoutData = layout.map(([component, {count, files: _files}]) => ({
          Component: component,
          Instances: count,
          Type: 'Layout',
        }));
        console.log('=== CORE COMPONENT USAGE (LAYOUT) ===');
        console.log(arrayToCSV(layoutData));
        console.log();
      }

      if (text.length > 0) {
        const textData = text.map(([component, {count, files: _files}]) => ({
          Component: component,
          Instances: count,
          Type: 'Text',
        }));
        console.log('=== CORE COMPONENT USAGE (TEXT) ===');
        console.log(arrayToCSV(textData));
        console.log();
      }
    } else {
      logger.log('\n🧩 Core Component Usage (from sentry/components/core):\n');

      // console.log('coreComponentUsage', coreComponentUsage);
      const layout = Array.from(coreComponentUsage.entries())
        .filter(
          ([component]) =>
            component.includes('Flex') ||
            component.includes('Grid') ||
            component.includes('Stack') ||
            component.includes('Container')
        )
        .sort((a, b) => b[1].count - a[1].count);

      const text = Array.from(coreComponentUsage.entries())
        .filter(
          ([component]) => component.includes('Text') || component.includes('Heading')
        )
        .sort((a, b) => b[1].count - a[1].count);

      console.table(
        layout.map(([component, {count, files: _files}]) => ({
          Component: component,
          Instances: count,
          // Files: files.join('\n'),
        }))
      );
      console.table(
        text.map(([component, {count, files: _files}]) => ({
          Component: component,
          Instances: count,
          // Files: files.join('\n'),
        }))
      );

      // console.table(
      //   Array.from(coreComponentUsage.entries())
      //     .sort((a, b) => b[1] - a[1])
      //     .map(([component, count]) => ({
      //       Component: component,
      //       'Usage Count': count,
      //     }))
      // );
    }
  }

  // function searchForDivsWithOnlyFlexRules(): string[] {
  //   const flexRules = new Set([
  //     'flex',
  //     'flex-direction',
  //     'flex-wrap',
  //     'justify-content',
  //     'align-items',
  //     'align-content',
  //     'gap',
  //   ]);

  //   const results: string[] = [];

  //   for (const key in styledInfo) {
  //     if (components?.has(key)) {
  //       const divs = styledInfo[key] ?? [];

  //       for (const div of divs) {
  //         let hasOnlyFlexRules = true;
  //         let hasDisplayFlexRule = false;

  //         if (!div.ruleInfo) {
  //           continue;
  //         }

  //         for (const rule in div.ruleInfo) {
  //           if (rule === 'display') {
  //             hasDisplayFlexRule =
  //               div.ruleInfo[rule]?.some(value => value.value === 'flex') ?? false;
  //           }

  //           if (rule !== 'display' && !flexRules.has(rule)) {
  //             hasOnlyFlexRules = false;
  //             break;
  //           }
  //         }

  //         if (hasDisplayFlexRule && hasOnlyFlexRules) {
  //           results.push(div.location);
  //         }
  //       }
  //     }
  //   }
  //   return results;
  // }

  // const divsWithOnlyFlexRules = searchForDivsWithOnlyFlexRules().slice(0, config.topN);
  // console.table(
  //   divsWithOnlyFlexRules.map((location, index) => ({
  //     '#': index + 1,
  //     Location: location,
  //   }))
  // );
} catch (error) {
  // Use global logger for error output
  logger.fatal(`❌ ${(error as Error).message}`);
  process.exit(1);
}
