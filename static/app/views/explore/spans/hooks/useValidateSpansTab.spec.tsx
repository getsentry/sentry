import type {ReactNode} from 'react';
import {PageFilterStateFixture, PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

jest.mock('sentry/components/pageFilters/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

const validationBody: EventValidationData = {
  dataset: [],
  environment: [],
  field: [],
  orderby: [],
  projects: [],
  query: {
    error: null,
    fields: [{attrType: 'string', error: null, name: 'span.op', valid: true}],
    valid: true,
  },
  valid: true,
};

describe('useValidateSpansTab', () => {
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

    const {result} = renderHookWithProviders(useValidateSpansTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {query: 'span.op:http'},
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
          dataset: TraceItemDataset.SPANS,
          environment: ['production'],
          project: ['1'],
          query: 'span.op:http',
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

    const {result} = renderHookWithProviders(useValidateSpansTab, {
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

    const {result, router} = renderHookWithProviders(useValidateSpansTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {query: 'missing.key:foo'},
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
      match: [MockApiClient.matchQuery({query: 'span.op:http'})],
    });

    router.navigate('/organizations/org-slug/explore/traces/?query=span.op%3Ahttp');

    await waitFor(() => {
      expect(delayedValidateMock).toHaveBeenCalled();
    });
    expect(result.current.data).toEqual(invalidValidationBody);
  });
});
