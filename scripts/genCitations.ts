'use strict';

/**
 * Generates src/sentry/seer/citations.generated.json from the frontend
 * citation schema. Sentry validates Seer's citations against it, and Seer
 * vendors it to type the citations its tools produce.
 *
 * Usage:
 *   pnpm gen:citations
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';
import {isDeepStrictEqual} from 'node:util';

import {citationsToJsonSchema} from 'sentry/components/seer/citations/schemas';

const OUT_PATH = path.resolve(process.cwd(), 'src/sentry/seer/citations.generated.json');

const schema = citationsToJsonSchema();

function isCurrent(): boolean {
  if (!existsSync(OUT_PATH)) {
    return false;
  }
  try {
    return isDeepStrictEqual(JSON.parse(readFileSync(OUT_PATH, 'utf8')), schema);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}

if (isCurrent()) {
  console.log(`Citation schema is up to date in ${OUT_PATH}`);
} else {
  writeFileSync(OUT_PATH, JSON.stringify(schema, null, 2) + '\n');
  console.log(`Wrote citation schema to ${OUT_PATH}`);
}
