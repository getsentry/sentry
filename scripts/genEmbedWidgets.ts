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
import {isDeepStrictEqual} from 'node:util';

import {seerEmbedsToJsonSchemas} from 'sentry/components/seer/markdown/embeds/schemas';

const OUT_PATH = path.resolve(
  process.cwd(),
  'src/sentry/seer/agent/embed_widgets.generated.json'
);

const transformedQueryWidgets = new Set(['spansQuery', 'logsQuery', 'metricsQuery']);
// The backend exposes these fields behind rollout flags before the frontend reader supports them.
const transformedQueryProperties = {
  transformations: {
    description:
      'Ordered transformations indexed by yAxes, including duplicate axes. Use [] for a raw axis. Steps use events-timeseries syntax, e.g. [[], ["fill(locf)", "smooth(sma,3)"]]. With no yAxes, transformations apply to the default aggregate.',
    type: 'array',
    items: {type: 'array', items: {type: 'string', minLength: 1}},
  },
  interval: {
    description: 'Bucket interval shared by all axes, e.g. "5m" or "1h".',
    type: 'string',
    pattern: '^[1-9]\\d*[smhdw]$',
  },
};
const widgets = seerEmbedsToJsonSchemas();
for (const {name, body} of widgets) {
  if (transformedQueryWidgets.has(name)) {
    const {properties} = body;
    if (!properties || typeof properties !== 'object') {
      throw new Error(`Expected object properties for ${name}`);
    }
    body.properties = {...transformedQueryProperties, ...properties};
  }
}
const output = JSON.stringify(widgets, null, 2);

function hasCurrentWidgets(): boolean {
  if (!existsSync(OUT_PATH)) {
    return false;
  }
  const existing = readFileSync(OUT_PATH, 'utf8');
  try {
    return isDeepStrictEqual(JSON.parse(existing), widgets);
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
