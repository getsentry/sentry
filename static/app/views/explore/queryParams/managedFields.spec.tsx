import {deriveUpdatedManagedFields} from 'sentry/views/explore/queryParams/managedFields';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  ReadableQueryParams,
  type ReadableQueryParamsOptions,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const defaultReadableQueryParamsOptions: ReadableQueryParamsOptions = {
  extrapolate: true,
  aggregateCursor: '',
  aggregateFields: [{groupBy: ''}, new VisualizeFunction('avg(foo)')],
  aggregateSortBys: [],
  cursor: '',
  fields: ['foo', 'bar'],
  mode: Mode.SAMPLES,
  query: '',
  sortBys: [],
};

describe('deriveUpdatedManagedFields', () => {
  it('should clear managed fields when clearing fields', () => {
    const managedFields = new Set<string>();
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {fields: null};
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });

  it('should not change managed fields when nothing changes', () => {
    const managedFields = new Set<string>();
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {};
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });

  it('should manage new group by field', () => {
    const managedFields = new Set<string>();
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: 'baz'}, {yAxes: ['avg(foo)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set(['baz']));
  });

  it('should keep managing unchanged group by field', () => {
    const managedFields = new Set<string>(['baz']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
      aggregateFields: [{groupBy: 'baz'}, new VisualizeFunction('avg(foo)')],
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: 'baz'}, {yAxes: ['avg(foo)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set(['baz']));
  });

  it('should stop managing removed group by field', () => {
    const managedFields = new Set<string>(['baz']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
      aggregateFields: [{groupBy: 'baz'}, new VisualizeFunction('avg(foo)')],
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });

  it('should manage new visualized field', () => {
    const managedFields = new Set<string>();
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}, {yAxes: ['avg(baz)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set(['baz']));
  });

  it('should keep managing unchanged visualized field', () => {
    const managedFields = new Set<string>(['baz']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
      aggregateFields: [
        {groupBy: ''},
        new VisualizeFunction('avg(foo)'),
        new VisualizeFunction('avg(baz)'),
      ],
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}, {yAxes: ['p50(baz)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set(['baz']));
  });

  it('should stop managing removed visualized field', () => {
    const managedFields = new Set<string>(['baz']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
      aggregateFields: [
        {groupBy: ''},
        new VisualizeFunction('avg(foo)'),
        new VisualizeFunction('avg(baz)'),
      ],
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });

  it('should stop managing removed field', () => {
    const managedFields = new Set<string>(['foo']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(bar)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });

  it('should keep managing when there is still a visualized or group by field', () => {
    const managedFields = new Set<string>(['foo']);
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
      aggregateFields: [
        {groupBy: ''},
        new VisualizeFunction('avg(foo)'),
        new VisualizeFunction('p50(foo)'),
      ],
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set(['foo']));
  });

  it('should not manage visualized field already in fields', () => {
    const managedFields = new Set<string>();
    const readableQueryParams = new ReadableQueryParams({
      ...defaultReadableQueryParamsOptions,
    });
    const writableQueryParams: WritableQueryParams = {
      aggregateFields: [{groupBy: ''}, {yAxes: ['avg(foo)']}, {yAxes: ['avg(bar)']}],
    };
    const {updatedManagedFields} = deriveUpdatedManagedFields(
      managedFields,
      readableQueryParams,
      writableQueryParams
    );
    expect(updatedManagedFields).toEqual(new Set());
  });
});
