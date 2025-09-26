import {defineBuildConfig} from 'unbuild';

export default defineBuildConfig({
  entries: ['./src/index', './src/attributes', './src/op'],
  outDir: 'dist',
  declaration: 'compatible',
  sourcemap: true,
  externals: ['rollup'],
  rollup: {
    emitCJS: true,
    esbuild: {
      minify: true,
    },
  },
});
