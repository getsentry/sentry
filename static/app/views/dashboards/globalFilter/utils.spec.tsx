import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {
  getFieldType,
  getFilterToken,
  isValidNumericFilterValue,
  newNumericFilterQuery,
  parseFilterValue,
} from 'sentry/views/dashboards/globalFilter/utils';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

beforeEach(() => {
  jest.clearAllMocks();
});

const stringDefinitionGetter: FieldDefinitionGetter = (_key, _type, kind) => ({
  desc: 'String Field',
  kind: kind ?? FieldKind.FIELD,
  valueType: FieldValueType.STRING,
});

const numericDefinitionGetter: FieldDefinitionGetter = (_key, _type, kind) => ({
  desc: 'Numeric Field',
  kind: kind ?? FieldKind.MEASUREMENT,
  valueType: FieldValueType.NUMBER,
});

describe('getFieldType', () => {
  it('maps widget types to field types', () => {
    expect(getFieldType(WidgetType.SPANS)).toBe('span');
    expect(getFieldType(WidgetType.LOGS)).toBe('log');
    expect(getFieldType(WidgetType.ERRORS)).toBe('event');
  });
});

describe('parseFilterValue', () => {
  it('parses a filter value into a filter token', () => {
    const globalFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'browser', name: 'Browser', kind: FieldKind.TAG},
      value: 'browser:chrome',
    };

    const tokens = parseFilterValue(
      'browser:chrome',
      globalFilter,
      stringDefinitionGetter
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.key.text).toBe('browser');
    expect(tokens[0]?.value.text).toBe('chrome');
  });
});

describe('getFilterToken', () => {
  it('returns the first filter token for empty values', () => {
    const globalFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'browser', name: 'Browser', kind: FieldKind.TAG},
      value: '',
    };

    const fieldDefinition = stringDefinitionGetter(
      globalFilter.tag.key,
      'event',
      globalFilter.tag.kind
    );
    const token = getFilterToken(globalFilter, fieldDefinition, stringDefinitionGetter);
    expect(token?.key.text).toBe('browser');
  });
});

describe('isValidNumericFilterValue', () => {
  it('validates numeric filter values', () => {
    const globalFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'duration', name: 'Duration', kind: FieldKind.MEASUREMENT},
      value: 'duration:>1',
    };

    const [token] = parseFilterValue(
      globalFilter.value,
      globalFilter,
      numericDefinitionGetter
    );

    expect(token).toBeDefined();
    if (!token) {
      return;
    }

    expect(
      isValidNumericFilterValue('123', token, globalFilter, numericDefinitionGetter)
    ).toBe(true);
    expect(
      isValidNumericFilterValue('nope', token, globalFilter, numericDefinitionGetter)
    ).toBe(false);
  });
});

describe('newNumericFilterQuery', () => {
  it('builds a numeric filter query with a new operator', () => {
    const globalFilter: GlobalFilter = {
      dataset: WidgetType.ERRORS,
      tag: {key: 'duration', name: 'Duration', kind: FieldKind.MEASUREMENT},
      value: 'duration:>1',
    };

    const [token] = parseFilterValue(
      globalFilter.value,
      globalFilter,
      numericDefinitionGetter
    );

    expect(token).toBeDefined();
    if (!token) {
      return;
    }

    expect(
      newNumericFilterQuery(
        '25',
        TermOperator.LESS_THAN,
        token,
        globalFilter,
        numericDefinitionGetter
      )
    ).toBe('duration:<25');
  });
});
