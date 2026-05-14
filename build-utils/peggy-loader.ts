import type {LoaderDefinitionFunction} from '@rspack/core';
import peggy from 'peggy';

type PeggyLoaderOptions = {
  allowedStartRules?: string[];
};

function getAllowedStartRules(
  source: string,
  options: PeggyLoaderOptions
): string[] | undefined {
  if (options.allowedStartRules) {
    return options.allowedStartRules;
  }

  const match = source.match(/@peggy-loader\s+allowedStartRules:\s*([^\n]+)/);
  return match?.[1]
    ?.split(',')
    .map(rule => rule.trim())
    .filter(Boolean);
}

const peggyLoader: LoaderDefinitionFunction<PeggyLoaderOptions> = function (source) {
  const options = this.getOptions();

  // https://peggyjs.org/documentation.html#generating-a-parser-javascript-api
  const peggyOptions: peggy.OutputFormatAmdCommonjsEs = {
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
