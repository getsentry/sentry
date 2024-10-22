import peggy from 'peggy';
import type {LoaderDefinitionFunction} from 'webpack';

const peggyLoader: LoaderDefinitionFunction = source => {
  // https://peggyjs.org/documentation.html#generating-a-parser-javascript-api
  const peggyOptions: peggy.OutputFormatAmdCommonjsEs = {
    cache: false,
    dependencies: {},
    format: 'commonjs',
    optimize: 'speed',
    trace: false,
    output: 'source',
  };

  return peggy.generate(source, peggyOptions);
};

export default peggyLoader;
