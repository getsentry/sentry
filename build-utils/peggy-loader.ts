import type {LoaderDefinitionFunction} from '@rspack/core';
import peggy from 'peggy';

type PeggyLoaderOptions = {
  allowedStartRules?: string[];
};

const ALLOWED_START_RULES_DIRECTIVE = /@peggy-loader\s+allowedStartRules:\s*([^\n]+)/;

function getAllowedStartRules(source: string, options: PeggyLoaderOptions): string[] {
  if (options.allowedStartRules?.length) {
    return options.allowedStartRules;
  }

  const match = source.match(ALLOWED_START_RULES_DIRECTIVE);
  if (!match) {
    return [];
  }

  const directiveValue = match[1];
  if (!directiveValue) {
    return [];
  }

  return directiveValue
    .split(',')
    .map(rule => rule.trim())
    .filter(Boolean);
}

const peggyLoader: LoaderDefinitionFunction<PeggyLoaderOptions> = function (source) {
  const options = this.getOptions();

  // https://peggyjs.org/documentation.html#generating-a-parser-javascript-api
  const peggyOptions: peggy.OutputFormatAmdCommonjsEs = {
    // Grammars with multiple public entry points can keep that contract next to
    // the grammar source via `@peggy-loader allowedStartRules: rule_a, rule_b`.
    allowedStartRules: getAllowedStartRules(source, options),
    cache: false,
    dependencies: {},
    format: 'es',
    optimize: 'speed',
    trace: false,
    output: 'source',
  };

  return peggy.generate(source, peggyOptions);
};

export default peggyLoader;
