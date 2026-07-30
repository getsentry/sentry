import type {ReactNode} from 'react';
import {PageFilterStateFixture, PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {FieldKind} from 'sentry/utils/fields';
import {LOGS_FIELDS_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

jest.mock('sentry/components/pageFilters/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

const validationBody: EventValidationData = {
  dataset: [],
  environment: [],
  field: [],
  orderby: [],
  projects: [],
  query: {
    error: null,
    fields: [
      {attrType: 'string', error: null, name: 'message.template', valid: true},
      {attrType: 'number', error: null, name: 'message.parameters.0', valid: true},
      {attrType: 'boolean', error: null, name: 'feature.enabled', valid: true},
      {attrType: null, error: 'unknown attribute', name: 'missing.key', valid: false},
    ],
    valid: false,
  },
  valid: false,
};

describe('useLogsSearchQueryBuilderProps', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: PageFiltersFixture({
          datetime: {period: '14d', start: null, end: null, utc: false},
          environments: [],
          projects: [1],
        }),
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('adds validated query fields to attributes and marks invalid filter keys', () => {
    const {result} = renderHookWithProviders(
      () =>
        useLogsSearchQueryBuilderProps({
          booleanAttributes: {},
          booleanSecondaryAliases: {},
          numberAttributes: {},
          numberSecondaryAliases: {},
          stringAttributes: {},
          stringSecondaryAliases: {},
          validatedSearchQueryData: validationBody,
        }),
      {additionalWrapper: Wrapper}
    );

    expect(
      result.current.tracesItemSearchQueryBuilderProps.stringAttributes[
        'message.template'
      ]
    ).toEqual(
      expect.objectContaining({
        kind: FieldKind.TAG,
        key: 'message.template',
      })
    );
    expect(
      result.current.tracesItemSearchQueryBuilderProps.numberAttributes[
        'message.parameters.0'
      ]
    ).toEqual(
      expect.objectContaining({
        kind: FieldKind.MEASUREMENT,
        key: 'message.parameters.0',
      })
    );
    expect(
      result.current.tracesItemSearchQueryBuilderProps.booleanAttributes[
        'feature.enabled'
      ]
    ).toEqual(
      expect.objectContaining({
        kind: FieldKind.BOOLEAN,
        key: 'feature.enabled',
      })
    );
    expect(result.current.tracesItemSearchQueryBuilderProps.invalidFilterKeys).toEqual([
      'missing.key',
    ]);
  });

  it('preserves quoted attribute keys containing colons', () => {
    const {result, router} = renderHookWithProviders(
      () =>
        useLogsSearchQueryBuilderProps({
          booleanAttributes: {},
          booleanSecondaryAliases: {},
          numberAttributes: {},
          numberSecondaryAliases: {},
          stringAttributes: {},
          stringSecondaryAliases: {},
        }),
      {additionalWrapper: Wrapper}
    );

    act(() => {
      result.current.tracesItemSearchQueryBuilderProps.onSearch?.(
        '"imaginary.attribute:made_up_key":asdf',
        {parsedQuery: null, queryIsValid: true}
      );
    });

    expect(router.location.query.logsQuery).toBe(
      '"imaginary.attribute:made_up_key":asdf'
    );
  });

  it('adds a field for an explicit numeric attribute containing colons', () => {
    const filterKey = 'imaginary.attribute:made_up_key';
    const {result, router} = renderHookWithProviders(
      () =>
        useLogsSearchQueryBuilderProps({
          booleanAttributes: {},
          booleanSecondaryAliases: {},
          numberAttributes: {
            [filterKey]: {
              key: filterKey,
              name: filterKey,
              kind: FieldKind.MEASUREMENT,
            },
          },
          numberSecondaryAliases: {},
          stringAttributes: {},
          stringSecondaryAliases: {},
        }),
      {additionalWrapper: Wrapper}
    );

    act(() => {
      result.current.tracesItemSearchQueryBuilderProps.onSearch?.(
        `tags[${filterKey},number]:>100`,
        {parsedQuery: null, queryIsValid: true}
      );
    });

    expect(router.location.query[LOGS_FIELDS_KEY]).toEqual([
      'timestamp',
      'message',
      filterKey,
    ]);
  });
});
