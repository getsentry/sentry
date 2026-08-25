import type {ReactNode} from 'react';
import {PageFilterStateFixture, PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {FieldKind} from 'sentry/utils/fields';
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
      {attrType: 'array', error: null, name: 'error.messages', valid: true},
      {attrType: null, error: 'unknown attribute', name: 'missing.key', valid: false},
    ],
    valid: false,
  },
  valid: false,
};

const arrayFeatures = {features: ['trace-item-array-query-support']};

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

  it('threads array attributes and aliases through to the builder props', () => {
    const {result} = renderHookWithProviders(
      () =>
        useLogsSearchQueryBuilderProps({
          arrayAttributes: {
            'tags[error.messages,array]': {
              key: 'tags[error.messages,array]',
              name: 'error.messages',
              kind: FieldKind.ARRAY,
            },
          },
          arraySecondaryAliases: {
            'error.messages': {
              key: 'error.messages',
              name: 'error.messages',
              kind: FieldKind.ARRAY,
            },
          },
          booleanAttributes: {},
          booleanSecondaryAliases: {},
          numberAttributes: {},
          numberSecondaryAliases: {},
          stringAttributes: {},
          stringSecondaryAliases: {},
        }),
      {additionalWrapper: Wrapper, organization: arrayFeatures}
    );

    expect(
      result.current.tracesItemSearchQueryBuilderProps.arrayAttributes?.[
        'tags[error.messages,array]'
      ]
    ).toEqual(
      expect.objectContaining({
        kind: FieldKind.ARRAY,
        key: 'tags[error.messages,array]',
      })
    );
    expect(
      result.current.tracesItemSearchQueryBuilderProps.arraySecondaryAliases?.[
        'error.messages'
      ]
    ).toEqual(expect.objectContaining({kind: FieldKind.ARRAY}));
  });

  it('merges validated array fields when the array flag is enabled', () => {
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
      {additionalWrapper: Wrapper, organization: arrayFeatures}
    );

    expect(
      result.current.tracesItemSearchQueryBuilderProps.arrayAttributes?.['error.messages']
    ).toEqual(
      expect.objectContaining({
        kind: FieldKind.ARRAY,
        key: 'error.messages',
      })
    );
  });

  it('does not merge validated array fields when the array flag is disabled', () => {
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
      result.current.tracesItemSearchQueryBuilderProps.arrayAttributes?.['error.messages']
    ).toBeUndefined();
    expect(result.current.tracesItemSearchQueryBuilderProps.invalidFilterKeys).toEqual([
      'missing.key',
    ]);
  });
});
