import type {Tag} from 'sentry/types/group';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function mockTraceItemAttributeKeysApi(
  orgSlug: string,
  attributeKeys: Tag[],
  itemType: TraceItemDataset = TraceItemDataset.LOGS,
  attributeType: 'string' | 'number' = 'string'
) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/trace-items/attributes/`,
    body: attributeKeys,
    match: [
      (_url: string, options: {query?: Record<string, any>}) => {
        const query = options?.query || {};
        return query.itemType === itemType && query.attributeType === attributeType;
      },
    ],
  });
}
