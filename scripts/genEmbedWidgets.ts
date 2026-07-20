'use strict';

/**
 * Generates src/sentry/seer/agent/embed_widgets.generated.json from the
 * frontend Seer embed schema definitions.
 *
 * Usage:
 *   pnpm gen:embed-widgets
 */
import {writeFileSync} from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

// @ts-expect-error — Node --experimental-transform-types requires .ts extension
// eslint-disable-next-line boundaries/dependencies -- codegen script
import {seerEmbedsToJsonSchemas} from '../static/app/components/seer/markdown/embeds/schemas.ts';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(
  THIS_DIR,
  '../src/sentry/seer/agent/embed_widgets.generated.json'
);

const widgets = seerEmbedsToJsonSchemas();

writeFileSync(OUT_PATH, JSON.stringify(widgets, null, 2) + '\n');

console.log(`Wrote ${widgets.length} embed widget(s) to ${OUT_PATH}`);
