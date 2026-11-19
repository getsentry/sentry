'use strict';

/**
 * Generates src/sentry/seer/agent/embed_widgets.generated.json from the
 * frontend Seer embed schema definitions.
 *
 * Usage:
 *   pnpm gen:embed-widgets
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';

import {seerEmbedsToJsonSchemas} from 'sentry/components/seer/markdown/embeds/schemas';

const OUT_PATH = path.resolve(
  process.cwd(),
  'src/sentry/seer/agent/embed_widgets.generated.json'
);

const widgets = seerEmbedsToJsonSchemas();
const output = JSON.stringify(widgets, null, 2);

function hasCurrentWidgets(): boolean {
  if (!existsSync(OUT_PATH)) {
    return false;
  }
  const existing = readFileSync(OUT_PATH, 'utf8');
  try {
    return JSON.stringify(JSON.parse(existing), null, 2) === output;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}

if (hasCurrentWidgets()) {
  console.log(`Embed widgets are up to date in ${OUT_PATH}`);
} else {
  writeFileSync(OUT_PATH, output + '\n');
  console.log(`Wrote ${widgets.length} embed widget(s) to ${OUT_PATH}`);
}
