import type {Nullable} from 'sentry/types/utils';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';

export type WritableQueryParams = Partial<Nullable<ReadableQueryParamsOptions>>;
