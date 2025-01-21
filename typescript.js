const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Sentry = require('@sentry/node');
const profiling = require('@sentry/profiling-node');

Sentry.init({
  debug: true,
  dsn: 'https://07898f7cdd56ebabb2761c0fb54578a1@o87286.ingest.us.sentry.io/4507936144031744',
  tracesSampleRate: 1.0,
  integrations: [profiling.nodeProfilingIntegration()],
  // transport: () => {
  //   let id = 0;
  //   return {
  //     send: (event) => {
  //       if (id > 10) {
  //         throw new Error('Dead')
  //       }
  //       fs.writeFileSync(`sentry.log.${id++}`, JSON.stringify(event, null, 2))
  //       return Promise.resolve();
  //     }, flush: () => {
  //       console.log('flush')
  //       return Promise.resolve();
  //     }
  //   }
  // }
});

const currentDir = process.cwd();
const configFile = ts.findConfigFile(currentDir, ts.sys.fileExists, 'tsconfig.json');
if (!configFile) {
  throw Error('tsconfig.json not found');
}

const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
const { options, fileNames, errors } = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  currentDir
);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error + '\n');
  }
  process.exit(1);
}

function compile() {
  Sentry.profiler.startProfiler();
  Sentry.startSpan({ name: 'compile' }, async () => {
    // @TODO: find config file, parse it
    const program = ts.createProgram(fileNames, options);
    const emitResult = program.emit();

    const allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      if (diagnostic.file) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start
        );
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.log(
          `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
        );
      } else {
        console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    });

    Sentry.profiler.stopProfiler();

    const exitCode = emitResult.emitSkipped ? 1 : 0;
    console.log(`Process exiting with code '${exitCode}'.`);
    process.exit(exitCode);
  });
}

(async () => {
  compile(process.argv.slice(2), {
    noEmitOnError: true,
    noImplicitAny: true,
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
  });
  await Sentry.flush();
})();
