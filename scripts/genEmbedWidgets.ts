'use strict';

/**
 * Generates src/sentry/seer/agent/embed_widgets.generated.json from the
 * frontend SeerTag schema definitions.
 *
 * Usage:
 *   pnpm gen:embed-widgets
 */
import {writeFileSync} from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

// @ts-expect-error — Node --experimental-transform-types requires .ts extension
// eslint-disable-next-line boundaries/dependencies -- codegen script
import {seerTagsToJsonSchemas} from '../static/app/views/seerExplorer/components/chat/seerTags.ts';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(
  THIS_DIR,
  '../src/sentry/seer/agent/embed_widgets.generated.json'
);

const widgets = seerTagsToJsonSchemas();

writeFileSync(OUT_PATH, JSON.stringify(widgets, null, 2) + '\n');

// eslint-disable-next-line no-console
console.log(`Wrote ${widgets.length} embed widget(s) to ${OUT_PATH}`);
