import type {WebpackChunk} from 'sentry/views/replays/types';

import webpackStats from '../../../../../../mock_chunk_data.json';

function getModulesWithSize(chunks: WebpackChunk[]): Record<string, number> {
  return Object.fromEntries(
    chunks.flatMap(chunk => chunk.modules.map(module => [module.id, module.size]))
  );
}

export const MODULES_WITH_SIZE = getModulesWithSize(webpackStats as WebpackChunk[]);
