import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const debugEnabled = false;
let topN = 10;

const debug = (...args: any[]) => debugEnabled && console.log(...args);
const log = (...args: any[]) => console.log(...args);
const fatal = (...args: any[]) => console.error(...args);

// Main execution
const args = process.argv.slice(2);
let searchDir: string | null = null;
let targetFile: string | null = null;
let components: Set<string> | null = new Set();

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--' && i + 1 < args.length) {
    targetFile = args[i + 1];
    break;
  } else if (args[i] === '-n' && i + 1 < args.length) {
    const nValue = parseInt(args[i + 1], 10);
    if (!isNaN(nValue) && nValue > 0) {
      topN = nValue;
    }
    i++; // Skip the next argument since we consumed it
  } else if (args[i] === '-c' && i + 1 < args.length) {
    components = components || new Set();
    const componentsArg = args[i + 1].split(',');
    componentsArg.map(c => c.trim()).forEach(c => components!.add(c));
    i++; // Skip the next argument since we consumed it
  } else if (!searchDir) {
    searchDir = args[i];
  }
}

// Default to './static/app' if no directory specified
if (!searchDir && !targetFile) {
  searchDir = './static/app';
}

let tsxFiles: string[] = [];

if (targetFile) {
  if (!fs.existsSync(targetFile)) {
    fatal(`❌ File not found: ${targetFile}`);
    process.exit(1);
  }
  if (!targetFile.endsWith('.tsx')) {
    fatal(`❌ File must be a .tsx file: ${targetFile}`);
    process.exit(1);
  }
  tsxFiles = [targetFile];
  log(`🔍 Analyzing single file: ${targetFile}\n`);
} else {
  tsxFiles = findTsxFiles(searchDir!);
  log(`🔍 Analyzing ${tsxFiles.length} .tsx files for styled components...\n`);
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

function analyzeStyledComponents(
  sourceFile: ts.SourceFile,
  fileName: string
): StyledComponent[] {
  const styledComponents: StyledComponent[] = [];

  function visit(node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.TaggedTemplateExpression) {
      const taggedExpr = node as ts.TaggedTemplateExpression;

      if (taggedExpr.tag.kind === ts.SyntaxKind.CallExpression) {
        const callExpr = taggedExpr.tag as ts.CallExpression;

        if (callExpr.expression.getText() === 'styled') {
          const component = callExpr.arguments[0];
          let componentName = '';
          let componentType: 'intrinsic' | 'component' | 'unknown' = 'unknown';

          // Extract component name and type
          if (
            // "span" or `span`
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
            // handle Component as any
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
            debug(
              'Debug: ',
              component.kind,
              'Text:',
              component.getText(),
              'File:',
              fileName
            );
          }

          // Extract CSS rules
          const cssRules = taggedExpr.template.getText();

          // Get location
          const {line, character} = sourceFile.getLineAndCharacterOfPosition(
            node.getStart()
          );

          // Count CSS rules and expressions
          const expressions =
            taggedExpr.template.kind === ts.SyntaxKind.TemplateExpression
              ? (taggedExpr.template as ts.TemplateExpression).templateSpans
              : [];
          const hasExpressions = expressions.length > 0;

          const shouldInclude = components === null || components.has(componentName);
          if (shouldInclude) {
            styledComponents.push({
              file: fileName,
              component: componentName,
              componentType,
              cssRules: cssRules.trim(),
              location: {
                line: line + 1,
                column: character + 1,
              },
              hasExpressions,
              expressionCount: expressions.length,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return styledComponents;
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
    debug(`❌ Error running ripgrep: ${(error as Error).message}, falling back to fs`);
    // Fallback to original implementation if ripgrep fails
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

const allStyledComponents: StyledComponent[] = [];
let totalIntrinsic = 0;
let totalComponents = 0;
let unknownComponents = 0;
let totalWithExpressions = 0;

for (const file of tsxFiles) {
  try {
    const sourceCode = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const styledComponents = analyzeStyledComponents(sourceFile, file);
    allStyledComponents.push(...styledComponents);

    // Update counters
    styledComponents.forEach(sc => {
      if (sc.componentType === 'component') totalComponents++;
      else if (sc.componentType === 'intrinsic') totalIntrinsic++;
      else unknownComponents++;
      if (sc.hasExpressions) totalWithExpressions++;
    });
  } catch (error) {
    fatal(`❌ Error parsing ${file}:`, (error as Error).message);
  }
}

// Output results
log(`📊 Found ${allStyledComponents.length} styled components:\n`);
log(`   • Intrinsic elements (div, span, etc.): ${totalIntrinsic}`);
log(`   • React components: ${totalComponents}`);
log(`   • Unknown components: ${unknownComponents}`);
log(`   • With dynamic expressions: ${totalWithExpressions}\n`);

const byFile: Record<string, StyledComponent[]> = {};
allStyledComponents.forEach(sc => {
  if (!byFile[sc.file]) byFile[sc.file] = [];
  byFile[sc.file].push(sc);
});

const mostStyledElements: Record<string, number> = {};
allStyledComponents.forEach(sc => {
  mostStyledElements[sc.component] = (mostStyledElements[sc.component] || 0) + 1;
});

log(`📂 Top 10 files with most styled components:\n`);
Object.entries(mostStyledElements)
  .sort((a, b) => b[1] - a[1])
  .slice(0, topN)
  .forEach(([component, count]) => {
    log(`   • ${component}: ${count} styled components`);
  });
