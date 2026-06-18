import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {FieldKind} from 'sentry/utils/fields';
import type {TraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

const mockUseSpanItemAttributes = jest.fn();
const mockUseTraceItemSearchQueryBuilderProps = jest.fn(
  (props: TraceItemSearchQueryBuilderProps) => props
);

jest.mock('sentry/views/explore/hooks/useTraceItemAttributes', () => ({
  useSpanItemAttributes: (params: unknown, type: string) =>
    mockUseSpanItemAttributes(params, type),
}));

jest.mock('sentry/views/explore/components/traceItemSearchQueryBuilder', () => ({
  useTraceItemSearchQueryBuilderProps: (props: TraceItemSearchQueryBuilderProps) =>
    mockUseTraceItemSearchQueryBuilderProps(props),
}));

const spanAttributesByType = {
  boolean: {
    'span.cached': {
      key: 'span.cached',
      name: 'span.cached',
      kind: FieldKind.BOOLEAN,
    },
  },
  number: {
    'span.duration': {
      key: 'span.duration',
      name: 'span.duration',
      kind: FieldKind.MEASUREMENT,
    },
  },
  string: {
    'span.op': {
      key: 'span.op',
      name: 'span.op',
      kind: FieldKind.TAG,
    },
  },
};

function makeValidationData(query: EventValidationData['query']): EventValidationData {
  return {
    dataset: [],
    environment: [],
    field: [],
    orderby: [],
    projects: [],
    query,
    valid: false,
  };
}

describe('useSpanSearchQueryBuilderProps', () => {
  beforeEach(() => {
    mockUseSpanItemAttributes.mockImplementation((_params, type) => ({
      attributes: spanAttributesByType[type as keyof typeof spanAttributesByType],
      isLoading: false,
      secondaryAliases: {},
    }));
    mockUseTraceItemSearchQueryBuilderProps.mockClear();
  });

  it('adds valid validation-only query keys and forwards invalid query keys', () => {
    const validatedSearchQueryData = makeValidationData([
      {attrType: 'boolean', error: null, name: 'custom.flag', valid: true},
      {attrType: 'number', error: null, name: 'custom.duration', valid: true},
      {attrType: 'string', error: null, name: 'custom.tag', valid: true},
      {attrType: 'string', error: null, name: 'span.op', valid: true},
      {attrType: null, error: 'unknown attribute', name: 'missing.key', valid: false},
    ]);

    const {result} = renderHook(() =>
      useSpanSearchQueryBuilderProps({
        initialQuery: 'custom.tag:value missing.key:value',
        searchSource: 'test',
        validatedSearchQueryData,
      })
    );

    expect(result.current.spanSearchQueryBuilderProps.booleanAttributes).toMatchObject({
      'custom.flag': {key: 'custom.flag', kind: FieldKind.BOOLEAN},
      'span.cached': {key: 'span.cached', kind: FieldKind.BOOLEAN},
    });
    expect(result.current.spanSearchQueryBuilderProps.numberAttributes).toMatchObject({
      'custom.duration': {key: 'custom.duration', kind: FieldKind.MEASUREMENT},
      'span.duration': {key: 'span.duration', kind: FieldKind.MEASUREMENT},
    });
    expect(result.current.spanSearchQueryBuilderProps.stringAttributes).toMatchObject({
      'custom.tag': {key: 'custom.tag', kind: FieldKind.TAG},
      'span.op': {key: 'span.op', kind: FieldKind.TAG},
    });
    expect(result.current.spanSearchQueryBuilderProps.invalidFilterKeys).toEqual([
      'missing.key',
    ]);

    expect(mockUseTraceItemSearchQueryBuilderProps).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidFilterKeys: ['missing.key'],
        stringAttributes: expect.objectContaining({
          'custom.tag': expect.objectContaining({kind: FieldKind.TAG}),
          'span.op': expect.objectContaining({kind: FieldKind.TAG}),
        }),
      })
    );
  });
});
