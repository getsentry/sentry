import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';

type AttributeResult = {
  data: TagCollection;
  error: Error | null;
  isLoading: boolean;
};

type AttributeResults = Record<AllowedDataScrubbingDatasets, AttributeResult | null>;

export type MockTraceItemAttributeResponse = {
  attributeType: 'string' | 'number' | 'boolean';
  key: string;
  name: string;
  secondaryAliases?: string[];
};

function getAttributeTypeFromTag(
  tag: Tag
): MockTraceItemAttributeResponse['attributeType'] {
  if (tag.kind === FieldKind.MEASUREMENT) {
    return 'number';
  }

  if (tag.kind === FieldKind.BOOLEAN) {
    return 'boolean';
  }

  return 'string';
}

export function createMockTraceItemAttributesResponse(
  empty = false
): MockTraceItemAttributeResponse[] {
  if (empty) {
    return [];
  }

  return [
    {attributeType: 'string', key: 'user.email', name: 'user.email'},
    {attributeType: 'string', key: 'user.id', name: 'user.id'},
    {attributeType: 'string', key: 'custom.field', name: 'custom.field'},
    {attributeType: 'string', key: 'request.method', name: 'request.method'},
    {attributeType: 'string', key: 'response.status', name: 'response.status'},
  ];
}

export function createMockAttributeResults(empty = false): AttributeResults {
  const mockAttributes: TagCollection = Object.fromEntries(
    createMockTraceItemAttributesResponse().map(attribute => [
      attribute.key,
      {
        key: attribute.key,
        name: attribute.name,
        secondaryAliases: attribute.secondaryAliases,
        kind:
          attribute.attributeType === 'number'
            ? FieldKind.MEASUREMENT
            : attribute.attributeType === 'boolean'
              ? FieldKind.BOOLEAN
              : FieldKind.TAG,
      },
    ])
  );

  const mockTraceItemAttributeKeysResult: AttributeResult = {
    data: mockAttributes,
    isLoading: false,
    error: null,
  };

  const mockTraceItemAttributeKeysEmptyResult: AttributeResult = {
    data: {},
    isLoading: false,
    error: null,
  };

  if (empty) {
    return {
      [AllowedDataScrubbingDatasets.DEFAULT]: null,
      [AllowedDataScrubbingDatasets.LOGS]: mockTraceItemAttributeKeysEmptyResult,
      [AllowedDataScrubbingDatasets.METRICS]: mockTraceItemAttributeKeysEmptyResult,
    };
  }

  return {
    [AllowedDataScrubbingDatasets.DEFAULT]: null,
    [AllowedDataScrubbingDatasets.LOGS]: mockTraceItemAttributeKeysResult,
    [AllowedDataScrubbingDatasets.METRICS]: mockTraceItemAttributeKeysResult,
  };
}

export function mockTraceItemAttributeKeysApi(
  orgSlug: string,
  attributeKeys: Tag[] | MockTraceItemAttributeResponse[],
  itemType: TraceItemDataset = TraceItemDataset.LOGS,
  attributeType: 'string' | 'number' = 'string'
) {
  const body = attributeKeys.map(attribute =>
    'attributeType' in attribute
      ? attribute
      : {
          attributeType: getAttributeTypeFromTag(attribute),
          key: attribute.key,
          name: attribute.name,
          secondaryAliases: attribute.secondaryAliases,
        }
  );

  return MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/trace-items/attributes/`,
    body,
    match: [
      (_url: string, options: {query?: Record<string, any>}) => {
        const query = options?.query || {};
        const queryAttributeType = query.attributeType;
        const matchesAttributeType = Array.isArray(queryAttributeType)
          ? queryAttributeType.includes(attributeType)
          : queryAttributeType === attributeType;

        return query.itemType === itemType && matchesAttributeType;
      },
    ],
  });
}
