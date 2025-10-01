import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {Mode} from 'sentry/views/explore/queryParams/mode';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

export interface ReadableQueryParamsOptions {
  readonly aggregateCursor: string;
  readonly aggregateFields: readonly AggregateField[];
  readonly aggregateSortBys: readonly Sort[];
  readonly cursor: string;
  readonly extrapolate: boolean;
  readonly fields: string[];
  readonly mode: Mode;
  readonly query: string;
  readonly sortBys: Sort[];
  readonly id?: string;
  readonly title?: string;
}

export class ReadableQueryParams {
  readonly extrapolate: boolean;
  readonly mode: Mode;
  readonly query: string;
  readonly search: MutableSearch;

  readonly cursor: string;
  readonly fields: string[];
  readonly sortBys: Sort[];

  readonly aggregateCursor: string;
  readonly aggregateFields: readonly AggregateField[];
  readonly aggregateSortBys: readonly Sort[];
  readonly groupBys: readonly string[];
  readonly visualizes: readonly Visualize[];

  readonly id?: string;
  readonly title?: string;

  constructor(options: ReadableQueryParamsOptions) {
    this.extrapolate = options.extrapolate;
    this.mode = options.mode;
    this.query = options.query;
    this.search = new MutableSearch(this.query);

    this.cursor = options.cursor;
    this.fields = options.fields;
    this.sortBys = options.sortBys;

    this.aggregateCursor = options.aggregateCursor;
    this.aggregateFields = options.aggregateFields;
    this.aggregateSortBys = options.aggregateSortBys;

    this.groupBys = this.aggregateFields.filter(isGroupBy).map(({groupBy}) => groupBy);
    this.visualizes = this.aggregateFields.filter(isVisualize);

    this.id = options.id;
    this.title = options.title;
  }
}
