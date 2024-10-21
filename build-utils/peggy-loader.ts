import peggy from 'peggy';

export default function peggyLoader(source) {
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
}
