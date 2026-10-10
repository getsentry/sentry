import fs from 'node:fs';

import {transformLinaria} from './linaria.ts';

// Jest's CJS transformer is synchronous. Keep the asynchronous compiler in a
// child process and let Jest cache the result through its normal source cache.
const source = fs.readFileSync(0, 'utf8');
const result = await transformLinaria(source, process.argv[2]);
process.stdout.write(JSON.stringify({code: result.code, cssText: result.cssText}));
