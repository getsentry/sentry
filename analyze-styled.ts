import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

let debugEnabled = false;
let topN = 10;

const log = (...args: any[]) => console.log(...args);
const debug = (...args: any[]) => debugEnabled && log(...args);
const fatal = (...args: any[]) => console.error(...args);

// Main execution
const args = process.argv.slice(2);
let searchDir: string | null = null;
let targetFile: string | null = null;
let locations = false;
let components: Set<string> | null = null;

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
  } else if (args[i] === '-l') {
    locations = true;
  } else if (args[i] === '-d') {
    debugEnabled = true;
  } else if (!searchDir) {
    searchDir = args[i];
  }
}

if (locations && !components) {
  process.exit(
    `❌ Error: -l option requires -c to specify components filter, otherwise it will analyze all styled components and produce a lot of output.`
  );
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
            // debug(
            //   'Debug: ',
            //   component.kind,
            //   'Text:',
            //   component.getText(),
            //   'File:',
            //   fileName
            // );
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
          // increment here because we want to count all styled components
          totalStyledComponents++;

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

const styledComponents: StyledComponent[] = [];
let totalIntrinsic = 0;
let totalStyledComponents = 0;
let totalReactComponents = 0;
let unknownComponents = 0;

const dynamicExpressions = 0;
const staticExpressions = 0;

for (const file of tsxFiles) {
  try {
    const sourceCode = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = analyzeStyledComponents(sourceFile, file);
    styledComponents.push(...result);

    // Update counters
    result.forEach(sc => {
      if (sc.componentType === 'component') totalReactComponents++;
      else if (sc.componentType === 'intrinsic') totalIntrinsic++;
      else unknownComponents++;
    });
  } catch (error) {
    fatal(`❌ Error parsing ${file}:`, (error as Error).message);
  }
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

    let [property, value] = line.split(':');
    property = property?.trim();
    value = value?.trim().replace(/;$/, '');

    if (property && value) {
      ruleInfo[property] = ruleInfo[property] || [];
      ruleInfo[property].push({
        value,
        dynamic: (value.match(/\$\{[^}]+\}/g) || []).length,
      });
    } else {
      // debug('❌ Error parsing line:\n', JSON.stringify(line, null, 2));
      fs.writeFileSync('analyze-styled-error.txt', `Error parsing line: ${line}\n`);
      process.exit(1);
      if (debugEnabled) {
        ruleInfo['parsing error'] = ruleInfo['parsing error'] || [];
        ruleInfo['parsing error'].push({
          value: line,
          dynamic: 0,
        });
      }
    }
  }

  styledInfo[sc.component].push({
    count,
    location: `${sc.file}:${sc.location.line}:${sc.location.column}`,
    expression: sc,
    ruleInfo,
  });
});

// log(' ');
// // Output results
// log(`📊 Found ${totalStyledComponents} styled components:\n`);
// log(`   • Intrinsic elements (div, span, etc.): ${totalIntrinsic}`);
// log(`   • React components: ${totalReactComponents}`);
// log(`   • Unknown components: ${unknownComponents}`);
// log(`   • Total files analyzed: ${tsxFiles.length}`);

// log(` `);
// log(`📄 Types of expressions:`);
// log(` `);
// log(
//   `   • Dynamic expressions per styled component: ~${(dynamicExpressions / totalStyledComponents).toFixed(2)}`
// );
// log(
//   `   • Static expressions per styled component: ~${(staticExpressions / totalStyledComponents).toFixed(2)}`
// );
// const totalExpressions = (dynamicExpressions || 0) + (staticExpressions || 0);
// const dynamicRatio =
//   totalExpressions > 0 ? (dynamicExpressions || 0) / totalExpressions : 0;
// const staticRatio =
//   totalExpressions > 0 ? (staticExpressions || 0) / totalExpressions : 0;

// log(`   • Total expressions: ${totalExpressions}`);
// log(
//   `   • Dynamic/Static ratio: ${(dynamicRatio * 100).toFixed(1)}% / ${(staticRatio * 100).toFixed(1)}%`
// );

// log(' ');

// log(`📂 Top ${topN} most styled components:\n`);
// console.table(
//   Object.entries(styledInfo)
//     .sort((a, b) => b[1].length - a[1].length)
//     .slice(0, topN)

//     .map(([component, info]) => {
//       const pct = (info.length / totalStyledComponents) * 100;
//       return {
//         Component: component,
//         'Styled Components': info.length,
//         '% of Total': pct < 1 ? '<1%' : `${pct.toFixed(1)}%`,
//       };
//     })
// );

// if (locations) {
//   log('\n📍 Locations of styled components:\n');
//   for (const [component, info] of Object.entries(styledInfo)) {
//     log(` ${component}:\n  • ${info.map(n => n.location).join('\n  • ')}`);
//   }
// }

// const commonRules: Record<string, number> = {};

// for (const [_, info] of Object.entries(styledInfo)) {
//   for (const rule of info) {
//     for (const [property, value] of Object.entries(rule.ruleInfo)) {
//       commonRules[property] = (commonRules[property] || 0) + value.length;
//     }
//   }
// }

// console.table(
//   Object.entries(commonRules)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 40)
//     .map(([property, count]) => ({
//       Property: property,
//       Count: count,
//       '% of Total': ((count / totalStyledComponents) * 100).toFixed(2) + '%',
//     }))
// );

// function searchForDivsWithOnlyFlexRules() {
//   const flexRules = new Set([
//     'flex',
//     'flex-direction',
//     'flex-wrap',
//     'justify-content',
//     'align-items',
//     'align-content',
//     'gap',
//   ]);

//   for (const key in styledInfo) {
//     if (key === 'div') {
//       const divs = styledInfo[key];

//       for (const div of divs) {
//         let hasOnlyFlexRules = true;
//         let hasDisplayFlexRule = false;

//         if (!div.ruleInfo) {
//           continue;
//         }

//         for (const rule in div.ruleInfo) {
//           if (rule === 'display') {
//             hasDisplayFlexRule = div.ruleInfo[rule].some(value => value.value === 'flex');
//           }

//           if (rule !== 'display' && !flexRules.has(rule)) {
//             hasOnlyFlexRules = false;
//             break;
//           }
//         }

//         if (hasDisplayFlexRule && hasOnlyFlexRules) {
//           console.log('Found div with only flex rules:', div.location);
//         }
//       }
//     }
//   }
// }

// searchForDivsWithOnlyFlexRules();
