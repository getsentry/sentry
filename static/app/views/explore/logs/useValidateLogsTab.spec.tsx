import type {ReactNode} from 'react';
import {PageFilterStateFixture, PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useValidateLogsTab} from 'sentry/views/explore/logs/useValidateLogsTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
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
    fields: [{attrType: 'string', error: null, name: 'severity', valid: true}],
    valid: true,
  },
  valid: true,
};

describe('useValidateLogsTab', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: PageFiltersFixture({
          datetime: {period: '14d', start: null, end: null, utc: false},
          environments: ['production'],
          projects: [1],
        }),
      })
    );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('returns validation data from the validate endpoint', async () => {
    const validateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: validationBody,
    });

    const {result} = renderHookWithProviders(useValidateLogsTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/logs/',
          query: {
            [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
            [LOGS_QUERY_KEY]: 'severity:error',
            [LOGS_SORT_BYS_KEY]: '-timestamp',
          },
        },
      },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(validationBody);
    });
    expect(validateMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/validate/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: TraceItemDataset.LOGS,
          environment: ['production'],
          field: expect.arrayContaining(['timestamp', 'message', 'count(message)']),
          orderby: expect.arrayContaining(['-timestamp', '-count(message)']),
          project: ['1'],
          query: 'severity:error',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('returns validation details from request errors', async () => {
    const invalidValidationBody: EventValidationData = {
      ...validationBody,
      query: {
        error: 'unknown attribute',
        fields: [
          {attrType: null, error: 'unknown attribute', name: 'missing.key', valid: false},
        ],
        valid: false,
      },
      valid: false,
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: invalidValidationBody,
      statusCode: 400,
    });

    const {result} = renderHookWithProviders(useValidateLogsTab, {
      additionalWrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(invalidValidationBody);
    });
  });

  it('keeps previous validation details while the next validation loads', async () => {
    const invalidValidationBody: EventValidationData = {
      ...validationBody,
      query: {
        error: 'unknown attribute',
        fields: [
          {attrType: null, error: 'unknown attribute', name: 'missing.key', valid: false},
        ],
        valid: false,
      },
      valid: false,
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: invalidValidationBody,
      statusCode: 400,
      match: [MockApiClient.matchQuery({query: 'missing.key:foo'})],
    });

    const {result, router} = renderHookWithProviders(useValidateLogsTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/logs/',
          query: {[LOGS_QUERY_KEY]: 'missing.key:foo'},
        },
      },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(invalidValidationBody);
    });

    const delayedValidateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: validationBody,
      asyncDelay: 100000,
      match: [MockApiClient.matchQuery({query: 'severity:error'})],
    });

    router.navigate(
      `/organizations/org-slug/explore/logs/?${LOGS_QUERY_KEY}=severity%3Aerror`
    );

    await waitFor(() => {
      expect(delayedValidateMock).toHaveBeenCalled();
    });
    expect(result.current.data).toEqual(invalidValidationBody);
  });
});
