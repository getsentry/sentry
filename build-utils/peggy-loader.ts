import type {LoaderDefinitionFunction} from '@rspack/core';
import peggy from 'peggy';

const peggyLoader: LoaderDefinitionFunction = source => {
  // https://peggyjs.org/documentation.html#generating-a-parser-javascript-api
  const peggyOptions: peggy.OutputFormatAmdCommonjsEs = {
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
