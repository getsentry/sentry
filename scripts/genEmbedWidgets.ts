'use strict';

/**
 * Generates src/sentry/seer/agent/embed_widgets.generated.json from the
 * frontend Seer embed schema definitions.
 *
 * Usage:
 *   pnpm gen:embed-widgets
 */
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import * as path from 'node:path';

// eslint-disable-next-line boundaries/dependencies -- codegen script
import {seerEmbedsToJsonSchemas} from '../static/app/components/seer/markdown/embeds/schemas';

const OUT_PATH = path.resolve(
  process.cwd(),
  'src/sentry/seer/agent/embed_widgets.generated.json'
);

const widgets = seerEmbedsToJsonSchemas();

writeFileSync(OUT_PATH, JSON.stringify(widgets, null, 2) + '\n');

// Format the output with oxfmt so the committed file is byte-for-byte stable
// regardless of JSON.stringify's spacing. This keeps the file in sync with the
// repo formatter and lets CI verify freshness with a plain `git diff`.
execFileSync('pnpm', ['oxfmt', OUT_PATH], {stdio: 'ignore'});

console.log(`Wrote ${widgets.length} embed widget(s) to ${OUT_PATH}`);
