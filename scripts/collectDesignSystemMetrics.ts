import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

import ts from 'typescript';

const roots = [
  'static/app',
  'static/gsApp',
  'static/gsAdmin',
  'static/packages/scraps/src',
];
const scopes = ['application', 'design-system'] as const;
type Scope = (typeof scopes)[number];
type Rule = {rule: string; stage: 'incubator' | 'enforced'};
type Finding = {
  column: number;
  file: string;
  line: number;
  message: string;
  rule: string;
};
type LintReport = {findings: Finding[]; rules: Rule[]};
type Component = {
  component: string;
  source: 'scraps' | 'core' | 'internal' | 'shared';
  uses: number;
};
type ComponentTotal = Component & {files: number};
type FileFacts = {
  components: Array<Component & {imports: string[]}>;
  emotion: {css: number; cssProps: number; references: number; styled: number};
  jsxElements: number;
  owners: string[];
  path: string;
  scope: Scope;
  violations: Record<string, number>;
};
type Bucket = {
  components: ComponentTotal[];
  css: number;
  cssProps: number;
  emotionFiles: number;
  files: number;
  jsxFiles: number;
  owner: string;
  rules: Array<Rule & {files: number; violations: number}>;
  scope: Scope;
  scrapsFiles: number;
  styled: number;
};
type Snapshot = {
  buckets: Bucket[];
  catalog: string[];
  collectedAt: string;
  commit: string;
  excludedFindings: number;
  files: FileFacts[];
  findings: Finding[];
  hashes: Record<string, string>;
  ruleBuckets: Array<{owner: string; rules: Bucket['rules']}>;
  rules: Rule[];
  schemaVersion: 1;
  scope: {exclusions: string; ownerTotalsOverlap: true; roots: string[]};
};

export function eligible(file: string) {
  return (
    roots.some(root => file.startsWith(`${root}/`)) &&
    /\.[jt]sx?$/.test(file) &&
    !/\.(?:spec|test|stories|story|generated|d)\.[jt]sx?$|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|tests|fixtures|stories|generated)\//.test(
      file
    )
  );
}

function designSystem(file: string) {
  return (
    file.startsWith('static/app/components/core/') ||
    file.startsWith('static/packages/scraps/src/')
  );
}

export function codeowners(contents: string) {
  const rules = contents.split('\n').flatMap(line => {
    const [pattern, ...owners] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (!pattern) {
      return [];
    }
    assert(!/[!\\[\]{}()]/.test(pattern), `Unsupported CODEOWNERS pattern ${pattern}`);
    const anchored = pattern.startsWith('/') || pattern.replace(/\/$/, '').includes('/');
    const normalized = pattern.replace(/^\//, '').replace(/\/$/, '');
    const expression = normalized
      .split('/')
      .map(part => {
        if (part === '**') {
          return '.*';
        }
        return part
          .split('')
          .map(character =>
            character === '*'
              ? '[^/]*'
              : character === '?'
                ? '[^/]'
                : RegExp.escape(character)
          )
          .join('');
      })
      .join('/')
      .replaceAll('.*/', '(?:.*/)?');
    return [
      {
        match: new RegExp(`${anchored ? '^' : '(?:^|/)'}${expression}(?:/|$)`),
        owners: [...new Set(owners)],
      },
    ];
  });
  return {
    owners: [...new Set(rules.flatMap(rule => rule.owners))].sort(),
    forFile(file: string) {
      return rules.findLast(rule => rule.match.test(file))?.owners ?? [];
    },
  };
}

export function analyzeSources(
  root: string,
  paths: string[],
  options: ts.CompilerOptions,
  ownership: ReturnType<typeof codeowners>
) {
  const program = ts.createProgram(
    paths.map(file => path.join(root, file)),
    {
      ...options,
      noResolve: true,
      noLib: true,
      types: [],
      allowJs: true,
      checkJs: false,
    }
  );
  const diagnostics = program.getSyntacticDiagnostics();
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: name => name,
      getCurrentDirectory: () => root,
      getNewLine: () => '\n',
    })
  );
  const checker = program.getTypeChecker();
  const resolutionCache = ts.createModuleResolutionCache(root, name => name, options);
  const canonical = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const identity = (symbol: ts.Symbol) => {
    const target = canonical(symbol);
    const declaration = target.valueDeclaration ?? target.declarations?.[0];
    return declaration
      ? `${path.relative(root, declaration.getSourceFile().fileName)}#${target.getName()}`
      : undefined;
  };
  const catalog = new Set<string>();
  const files: FileFacts[] = [];
  for (const file of paths) {
    const source = program.getSourceFile(path.join(root, file))!;
    const facts: FileFacts = {
      path: file,
      owners: ownership.forFile(file),
      scope: designSystem(file) ? 'design-system' : 'application',
      jsxElements: 0,
      components: [],
      emotion: {references: 0, styled: 0, css: 0, cssProps: 0},
      violations: {},
    };
    if (designSystem(file)) {
      const module = checker.getSymbolAtLocation(source);
      for (const exported of module ? checker.getExportsOfModule(module) : []) {
        const target = canonical(exported);
        const id = identity(target);
        const declaration = target.valueDeclaration;
        let initializer =
          declaration && ts.isVariableDeclaration(declaration)
            ? declaration.initializer
            : undefined;
        while (
          initializer &&
          (ts.isAsExpression(initializer) ||
            ts.isTypeAssertionExpression(initializer) ||
            ts.isParenthesizedExpression(initializer) ||
            ts.isSatisfiesExpression(initializer))
        ) {
          initializer = initializer.expression;
        }
        const componentDeclaration =
          declaration &&
          (ts.isFunctionDeclaration(declaration) ||
            ts.isClassDeclaration(declaration) ||
            (initializer &&
              (ts.isArrowFunction(initializer) ||
                ts.isFunctionExpression(initializer) ||
                ts.isCallExpression(initializer) ||
                ts.isTaggedTemplateExpression(initializer) ||
                ts.isIdentifier(initializer))));
        if (
          id &&
          componentDeclaration &&
          ((/^[A-Z]/.test(exported.name) && /[a-z]/.test(exported.name)) ||
            exported.name === 'default')
        ) {
          catalog.add(id);
          if (
            initializer &&
            ts.isCallExpression(initializer) &&
            initializer.expression.getText() === 'Object.assign'
          ) {
            for (const argument of initializer.arguments) {
              if (ts.isObjectLiteralExpression(argument)) {
                for (const member of argument.properties) {
                  if (
                    member.name &&
                    ts.isIdentifier(member.name) &&
                    /^[A-Z]/.test(member.name.text)
                  ) {
                    catalog.add(`${id}.${member.name.text}`);
                  }
                }
              }
            }
          }
        }
      }
    }
    const imports = new Map<ts.Symbol, {exported: string; source: string}>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.importClause?.isTypeOnly
      ) {
        continue;
      }
      const clause = statement.importClause;
      const add = (name: ts.Identifier, exported: string) => {
        const symbol = checker.getSymbolAtLocation(name);
        if (symbol) {
          imports.set(symbol, {
            source: statement.moduleSpecifier.getText(source).slice(1, -1),
            exported,
          });
        }
      };
      if (clause?.name) {
        add(clause.name, 'default');
      }
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          add(clause.namedBindings.name, '*');
        } else {
          for (const element of clause.namedBindings.elements) {
            if (!element.isTypeOnly) {
              add(element.name, (element.propertyName ?? element.name).text);
            }
          }
        }
      }
    }
    const binding = (
      node: ts.Node
    ):
      | {exported: string; members: string[]; source: string; symbol: ts.Symbol}
      | undefined => {
      if (ts.isPropertyAccessExpression(node)) {
        const parent = binding(node.expression);
        return parent
          ? {...parent, members: [...parent.members, node.name.text]}
          : undefined;
      }
      if (!ts.isIdentifier(node)) {
        return undefined;
      }
      const symbol = checker.getSymbolAtLocation(node);
      const imported = symbol && imports.get(symbol);
      return symbol && imported ? {symbol, ...imported, members: []} : undefined;
    };
    const emotionKind = (node: ts.Node): 'styled' | 'css' | undefined => {
      const imported = binding(node);
      if (!imported) {
        return undefined;
      }
      if (
        imported.source === '@emotion/styled' &&
        (imported.exported === 'default' ||
          imported.exported === 'styled' ||
          (imported.exported === '*' &&
            ['default', 'styled'].includes(imported.members[0] ?? '')))
      ) {
        return 'styled';
      }
      if (
        ['@emotion/react', '@emotion/css'].includes(imported.source) &&
        (imported.exported === 'css' ||
          (imported.exported === '*' && imported.members.join('.') === 'css'))
      ) {
        return 'css';
      }
      return undefined;
    };
    const componentCounts = new Map<string, FileFacts['components'][number]>();
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        return;
      }
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol && imports.get(symbol)?.source.startsWith('@emotion/')) {
          facts.emotion.references++;
        }
      }
      if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) {
        const expression = ts.isCallExpression(node) ? node.expression : node.tag;
        const inner = ts.isCallExpression(expression)
          ? expression.expression
          : expression;
        const kind = emotionKind(inner);
        const isFactory =
          (ts.isCallExpression(node.parent) && node.parent.expression === node) ||
          (ts.isTaggedTemplateExpression(node.parent) && node.parent.tag === node);
        if (kind && !(kind === 'styled' && isFactory)) {
          facts.emotion[kind]++;
        }
      }
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'css') {
        facts.emotion.cssProps++;
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        facts.jsxElements++;
        const imported = binding(node.tagName);
        if (imported) {
          let target = canonical(imported.symbol);
          const members = [...imported.members];
          if (imported.exported === '*') {
            const member = members.shift();
            const exported = checker
              .getExportsOfModule(target)
              .find(item => item.name === member);
            if (exported) {
              target = canonical(exported);
            }
          }
          const canonicalId = identity(target);
          const resolved =
            !canonicalId &&
            ts.resolveModuleName(
              imported.source,
              source.fileName,
              options,
              ts.sys,
              resolutionCache
            ).resolvedModule;
          const id =
            canonicalId ??
            (resolved
              ? `${path.relative(root, resolved.resolvedFileName)}#${imported.exported === '*' ? imported.members[0] : imported.exported}`
              : undefined);
          if (id) {
            const declarationFile = id.split('#')[0]!;
            const scraps =
              imported.source.startsWith('@sentry/scraps') ||
              designSystem(declarationFile);
            const shared =
              declarationFile.startsWith('static/app/components/') ||
              declarationFile.startsWith('static/gsApp/components/') ||
              declarationFile.startsWith('static/gsAdmin/components/');
            if (scraps || shared) {
              const component = [id, ...members].join('.');
              const importSource: Component['source'] = imported.source.startsWith(
                '@sentry/scraps'
              )
                ? 'scraps'
                : imported.source.startsWith('sentry/components/core/')
                  ? 'core'
                  : scraps
                    ? 'internal'
                    : 'shared';
              const key = `${component}:${importSource}`;
              const count = componentCounts.get(key) ?? {
                component,
                source: importSource,
                uses: 0,
                imports: [],
              };
              count.uses++;
              if (!count.imports.includes(imported.source)) {
                count.imports.push(imported.source);
              }
              componentCounts.set(key, count);
              if (scraps) {
                catalog.add(component);
              }
            }
          } else if (imported.source.startsWith('@sentry/scraps')) {
            throw new Error(`Unresolved Scraps component ${imported.source} in ${file}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    facts.components = [...componentCounts.values()].sort(
      (a, b) => a.component.localeCompare(b.component) || a.source.localeCompare(b.source)
    );
    files.push(facts);
  }
  return {files, catalog: [...catalog].sort()};
}

export function parseLintReport(bytes: string): LintReport {
  const report = JSON.parse(bytes) as LintReport;
  assert(
    Array.isArray(report.rules) && Array.isArray(report.findings),
    'Invalid lint report'
  );
  const rules = new Set<string>();
  for (const item of report.rules) {
    assert(
      typeof item.rule === 'string' &&
        item.rule.startsWith('@sentry/scraps/') &&
        ['enforced', 'incubator'].includes(item.stage) &&
        !rules.has(item.rule),
      'Invalid monitored rule'
    );
    rules.add(item.rule);
  }
  for (const finding of report.findings) {
    assert(
      typeof finding.file === 'string' &&
        rules.has(finding.rule) &&
        Number.isInteger(finding.line) &&
        Number.isInteger(finding.column) &&
        typeof finding.message === 'string',
      'Invalid lint finding'
    );
  }
  return report;
}

export function aggregate(files: FileFacts[], rules: Rule[], owners: string[]): Bucket[] {
  const buckets: Bucket[] = [];
  for (const owner of ['all', 'unowned', ...owners]) {
    for (const scope of scopes) {
      const selected = files.filter(
        file =>
          file.scope === scope &&
          (owner === 'all' ||
            (owner === 'unowned'
              ? file.owners.length === 0
              : file.owners.includes(owner)))
      );
      const components = new Map<string, ComponentTotal>();
      for (const file of selected) {
        for (const item of file.components) {
          const key = `${item.component}:${item.source}`;
          const total = components.get(key) ?? {
            component: item.component,
            source: item.source,
            uses: 0,
            files: 0,
          };
          total.uses += item.uses;
          total.files++;
          components.set(key, total);
        }
      }
      buckets.push({
        owner,
        scope,
        files: selected.length,
        jsxFiles: selected.filter(file => file.jsxElements > 0).length,
        scrapsFiles: selected.filter(file =>
          file.components.some(item => item.source === 'scraps')
        ).length,
        emotionFiles: selected.filter(
          file => file.emotion.references > 0 || file.emotion.cssProps > 0
        ).length,
        styled: selected.reduce((sum, file) => sum + file.emotion.styled, 0),
        css: selected.reduce((sum, file) => sum + file.emotion.css, 0),
        cssProps: selected.reduce((sum, file) => sum + file.emotion.cssProps, 0),
        components: [...components.values()].sort(
          (a, b) => b.files - a.files || a.component.localeCompare(b.component)
        ),
        rules: rules.map(rule => ({
          ...rule,
          violations: selected.reduce(
            (sum, file) => sum + (file.violations[rule.rule] ?? 0),
            0
          ),
          files: selected.filter(file => file.violations[rule.rule]).length,
        })),
      });
    }
  }
  return buckets;
}

export function aggregateRules(
  report: LintReport,
  ownership: ReturnType<typeof codeowners>
) {
  const findings = report.findings.map(finding => ({
    ...finding,
    owners: ownership.forFile(finding.file),
  }));
  return ['all', 'unowned', ...ownership.owners].map(owner => ({
    owner,
    rules: report.rules.map(rule => {
      const matching = findings.filter(
        finding =>
          finding.rule === rule.rule &&
          (owner === 'all' ||
            (owner === 'unowned'
              ? finding.owners.length === 0
              : finding.owners.includes(owner)))
      );
      return {
        ...rule,
        violations: matching.length,
        files: new Set(matching.map(finding => finding.file)).size,
      };
    }),
  }));
}

export function* measurements(
  snapshot: Pick<Snapshot, 'buckets' | 'catalog' | 'ruleBuckets'>
) {
  for (const bucket of snapshot.ruleBuckets) {
    for (const rule of bucket.rules) {
      for (const field of ['violations', 'files'] as const) {
        yield {
          name: `design_system.rule.${field}`,
          value: rule[field],
          attributes: {
            owner: bucket.owner,
            scope: 'repository',
            rule: rule.rule,
            stage: rule.stage,
          },
        };
      }
    }
  }
  for (const bucket of snapshot.buckets) {
    const attributes = {owner: bucket.owner, scope: bucket.scope};
    for (const field of [
      'files',
      'jsxFiles',
      'scrapsFiles',
      'emotionFiles',
      'styled',
      'css',
      'cssProps',
    ] as const) {
      yield {name: `design_system.${field}`, value: bucket[field], attributes};
    }
    if (bucket.scope === 'design-system' && bucket.owner !== 'all') {
      continue;
    }
    const components = new Map(
      bucket.components.map(component => [
        `${component.component}:${component.source}`,
        component,
      ])
    );
    for (const component of snapshot.catalog) {
      for (const source of ['scraps', 'core', 'internal'] as const) {
        const counts = components.get(`${component}:${source}`);
        for (const field of ['uses', 'files'] as const) {
          yield {
            name: `design_system.component.${field}`,
            value: counts?.[field] ?? 0,
            attributes: {...attributes, component, source},
          };
        }
      }
    }
  }
}

export async function publish(
  snapshot: Snapshot,
  sdk: Pick<
    typeof import('@sentry/node'),
    'init' | 'metrics' | 'flush' | 'makeNodeTransport'
  >,
  dsn: string | undefined
) {
  assert(dsn, 'Publishing requires DESIGN_SYSTEM_METRICS_DSN');
  let deliveryError: Error | undefined;
  let acknowledged = 0;
  sdk.init({
    dsn,
    environment: 'production',
    release: snapshot.commit,
    defaultIntegrations: false,
    transport(options) {
      const transport = sdk.makeNodeTransport(options);
      return {
        flush: timeout => transport.flush(timeout),
        async send(envelope) {
          try {
            const response = await transport.send(envelope);
            assert(
              response.statusCode &&
                response.statusCode >= 200 &&
                response.statusCode < 300,
              `Sentry rejected metrics (${response.statusCode ?? 'dropped'})`
            );
            acknowledged += envelope[1].reduce(
              (sum, [header]) =>
                sum + (header.type === 'trace_metric' ? Number(header.item_count) : 0),
              0
            );
            return response;
          } catch (error) {
            deliveryError = error instanceof Error ? error : new Error(String(error));
            throw error;
          }
        },
      };
    },
  });
  let count = 0;
  const flush = async () => {
    assert(await sdk.flush(30_000), 'Sentry metrics flush failed');
    if (deliveryError) {
      throw deliveryError;
    }
    assert.equal(acknowledged, count, 'Sentry did not acknowledge all metrics');
  };
  for (const metric of measurements(snapshot)) {
    sdk.metrics.gauge(metric.name, metric.value, {attributes: metric.attributes});
    if (++count % 500 === 0) {
      await flush();
    }
  }
  await flush();
  sdk.metrics.gauge(
    'design_system.collected_at',
    Date.parse(snapshot.collectedAt) / 1000
  );
  count++;
  await flush();
  return count;
}

async function main() {
  const {values} = parseArgs({
    options: {
      output: {type: 'string', default: '.artifacts/design-system-metrics.json'},
      publish: {type: 'boolean'},
    },
  });
  const root = process.cwd();
  const git = (...args: string[]) =>
    execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean).sort();
  const ownership = codeowners(readFileSync('.github/CODEOWNERS', 'utf8'));
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  assert(!config.error, 'Cannot read tsconfig.json');
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  const {files, catalog} = analyzeSources(
    root,
    tracked.filter(eligible),
    options,
    ownership
  );
  const report = parseLintReport(
    execFileSync(process.execPath, ['scripts/custom-oxlint.ts', '--report-scraps'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  );
  const byPath = new Map(files.map(file => [file.path, file]));
  let excludedFindings = 0;
  for (const finding of report.findings) {
    const file = byPath.get(finding.file);
    if (file) {
      file.violations[finding.rule] = (file.violations[finding.rule] ?? 0) + 1;
    } else {
      excludedFindings++;
    }
  }
  const hash = (paths: string[]) => {
    const digest = createHash('sha256');
    for (const file of paths) {
      digest.update(file).update('\0').update(readFileSync(file)).update('\0');
    }
    return digest.digest('hex');
  };
  const snapshot: Snapshot = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    commit: git('rev-parse', 'HEAD').trim(),
    hashes: {
      codeowners: hash(['.github/CODEOWNERS']),
      collector: hash([
        'scripts/collectDesignSystemMetrics.ts',
        'scripts/custom-oxlint.ts',
      ]),
      policy: hash(
        tracked.filter(
          file =>
            file.startsWith('static/oxlint/') ||
            /^(?:oxlint\.config\.ts|tsconfig.*\.json|pnpm-lock\.yaml|\.node-version)$/.test(
              file
            )
        )
      ),
    },
    scope: {
      roots,
      exclusions:
        'Tests, stories, fixtures, generated files and declarations; see eligible().',
      ownerTotalsOverlap: true,
    },
    rules: report.rules,
    catalog,
    files,
    buckets: aggregate(
      files,
      report.rules,
      [...new Set(files.flatMap(file => file.owners))].sort()
    ),
    ruleBuckets: aggregateRules(report, ownership),
    findings: report.findings,
    excludedFindings,
  };
  mkdirSync(path.dirname(values.output), {recursive: true});
  const temporary = `${values.output}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {flag: 'wx'});
    renameSync(temporary, values.output);
  } finally {
    rmSync(temporary, {force: true});
  }
  console.log(
    `Collected ${files.length} files, ${catalog.length} components, ${report.rules.length} rules into ${values.output}`
  );
  if (values.publish) {
    console.log(
      `Published ${await publish(snapshot, await import('@sentry/node'), process.env.DESIGN_SYSTEM_METRICS_DSN)} gauges`
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
