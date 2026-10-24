import {FieldKind} from 'sentry/utils/fields';
import {
  getTagKeysInMultipleDatasets,
  isValidGlobalFilter,
} from 'sentry/views/dashboards/globalFilter/utils';
import {WidgetType} from 'sentry/views/dashboards/types';

describe('isValidGlobalFilter', () => {
  const validFilter = {
    dataset: WidgetType.SPANS,
    tag: {key: 'os.name', name: 'os.name', kind: FieldKind.TAG},
    value: 'os.name:[Linux]',
  };

  it('accepts a well-formed filter', () => {
    expect(isValidGlobalFilter(validFilter)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'os.name'],
    ['a filter without a tag', {dataset: WidgetType.SPANS, value: ''}],
    ['a filter with a null tag', {...validFilter, tag: null}],
    ['a filter whose tag has no key', {...validFilter, tag: {name: 'os.name'}}],
    ['a filter without a dataset', {tag: validFilter.tag, value: ''}],
  ])('rejects %s', (_label, filter) => {
    expect(isValidGlobalFilter(filter)).toBe(false);
  });

  it('lets getTagKeysInMultipleDatasets run on sanitized input', () => {
    const filters = [validFilter, {dataset: WidgetType.LOGS, value: ''}].filter(
      isValidGlobalFilter
    );
    expect(getTagKeysInMultipleDatasets(filters)).toEqual(new Set());
  });
});
