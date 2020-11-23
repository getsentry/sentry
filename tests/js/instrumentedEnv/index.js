/* eslint-env node */
const process = require('process'); // eslint-disable-line import/no-nodejs-modules

// TODO: Make this configurable
const JsDomEnvironment = require('@visual-snapshot/jest-environment');

const Sentry = require('@sentry/node');
require('@sentry/tracing');

function isNotTransaction(span) {
  return span.op !== 'jest test';
}

class SentryEnvironment extends JsDomEnvironment {
  constructor(config, context) {
    super(config, context);

    if (!config.testEnvironmentOptions || !config.testEnvironmentOptions.SENTRY_DSN) {
      return;
    }

    this.Sentry = Sentry;
    this.Sentry.init({
      dsn: config.testEnvironmentOptions.SENTRY_DSN,
      tracesSampleRate: 1.0,
      environment: !!process.env.CI ? 'ci' : 'local',
    });
    this.testPath = context.testPath.replace(process.cwd(), '');

    this.runDescribe = new Map();
    this.testContainers = new Map();
    this.tests = new Map();
    this.hooks = new Map();
  }

  async setup() {
    if (!this.Sentry) {
      await super.setup();
      return;
    }

    this.transaction = Sentry.startTransaction({
      op: 'jest test suite',
      description: this.testPath,
      name: this.testPath,
    });

    Sentry.configureScope(scope => scope.setSpan(this.transaction));

    const span = this.transaction.startChild({
      op: 'setup',
      description: this.testPath,
    });
    await super.setup();
    span.finish();
  }

  async teardown() {
    if (!this.Sentry) {
      await super.teardown();
      return;
    }

    const span = this.transaction.startChild({
      op: 'teardown',
      description: this.testPath,
    });
    await super.teardown();
    span.finish();

    if (this.transaction) {
      this.transaction.finish();
    }

    this.runDescribe = null;
    this.testContainers = null;
    this.tests = null;
    this.hooks = null;
    this.hub = null;
    this.Sentry = null;
  }

  runScript(script) {
    // We are intentionally not instrumenting this as it will produce hundreds of spans.
    return super.runScript(script);
  }

  getName(parent) {
    if (!parent) {
      return '';
    }

    // Ignore these for now as it adds a level of nesting and I'm not quite sure where it's even coming from
    if (parent.name === 'ROOT_DESCRIBE_BLOCK') {
      return '';
    }

    const parentName = this.getName(parent.parent);
    return `${parentName ? `${parentName} >` : ''} ${parent.name}`;
  }

  getData({name, ...event}) {
    switch (name) {
      case 'run_describe_start':
      case 'run_describe_finish':
        return {
          op: 'describe',
          obj: event.describeBlock,
          parentObj: event.describeBlock.parent,
          dataStore: this.runDescribe,
          parentStore: this.runDescribe,
        };

      case 'test_start':
      case 'test_done':
        return {
          op: 'test',
          obj: event.test,
          parentObj: event.test.parent,
          dataStore: this.testContainers,
          parentStore: this.runDescribe,
          beforeFinish: span => {
            span.setStatus(!event.test.errors.length ? 'ok' : 'unknown_error');
            return span;
          },
        };

      case 'test_fn_start':
      case 'test_fn_success':
      case 'test_fn_failure':
        return {
          op: 'test-fn',
          obj: event.test,
          parentObj: event.test,
          dataStore: this.tests,
          parentStore: this.testContainers,
          beforeFinish: span => {
            span.setStatus(!event.test.errors.length ? 'ok' : 'unknown_error');
            return span;
          },
        };

      case 'hook_start':
        return {
          obj: event.hook.parent,
          op: event.hook.type,
          dataStore: this.hooks,
        };

      case 'hook_success':
      case 'hook_failure':
        return {
          obj: event.hook.parent,
          parentObj: event.test && event.test.parent,
          dataStore: this.hooks,
          parentStore: this.testContainers,
          beforeFinish: span => {
            const parent = this.testContainers.get(this.getName(event.test));
            if (parent && !Array.isArray(parent)) {
              return parent.child(span);
            } else if (Array.isArray(parent)) {
              return parent.find(isNotTransaction).child(span);
            }
            return span;
          },
        };

      case 'start_describe_definition':
      case 'finish_describe_definition':
      case 'add_test':
      case 'add_hook':
      case 'run_start':
      case 'run_finish':
      case 'test_todo':
      case 'setup':
      case 'teardown':
        return null;

      default:
        return null;
    }
  }

  handleTestEvent(event) {
    if (!this.Sentry) {
      return;
    }

    const data = this.getData(event);
    const {name} = event;

    if (!data) {
      return;
    }

    const {obj, parentObj, dataStore, parentStore, op, description, beforeFinish} = data;

    const testName = this.getName(obj);

    if (name.includes('start')) {
      // Make this an option maybe
      if (!testName) {
        return;
      }

      const spans = [];
      const parentName = parentObj && this.getName(parentObj);
      const spanProps = {op, description: description || testName};
      const span =
        parentObj && parentStore.has(parentName)
          ? Array.isArray(parentStore.get(parentName))
            ? parentStore
                .get(parentName)
                .map(s =>
                  typeof s.child === 'function'
                    ? s.child(spanProps)
                    : s.startChild(spanProps)
                )
            : [parentStore.get(parentName).child(spanProps)]
          : [this.transaction.startChild(spanProps)];

      spans.push(...span);

      // If we are starting a test, let's also make it a transaction so we can see our slowest tests
      if (spanProps.op === 'test') {
        spans.push(
          Sentry.startTransaction({
            ...spanProps,
            op: 'jest test',
            name: spanProps.description,
            description: null,
          })
        );
      }

      dataStore.set(testName, spans);

      return;
    }

    if (dataStore.has(testName)) {
      const spans = dataStore.get(testName);

      spans.forEach(span => {
        if (beforeFinish) {
          span = beforeFinish(span);
          if (!span) {
            throw new Error('`beforeFinish()` needs to return a span');
          }
        }

        span.finish();
      });
    }
  }
}

module.exports = SentryEnvironment;
