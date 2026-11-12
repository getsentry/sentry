import fs from 'node:fs';

import {createRsbuild, loadConfig} from '@rsbuild/core';

const config = await loadConfig({path: 'rsbuild.config.ts', command: 'build'});
const rsbuild = await createRsbuild({config});
const {stats, close} = await rsbuild.build();

if (!stats) {
  throw new Error('Rsbuild did not return build statistics');
}

fs.writeFileSync(
  'stats.rspack.json',
  JSON.stringify(
    stats.toJson({
      all: false,
      assets: true,
      modules: true,
      chunks: true,
      entrypoints: true,
      timings: true,
    })
  )
);
await close();
