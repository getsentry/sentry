import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  useAttributeValidation,
  type AttributeValidationSelection,
} from 'sentry/views/explore/hooks/useAttributeValidation';
import {TraceItemDataset} from 'sentry/views/explore/types';

const ORG_SLUG = 'org-slug';
const DEFAULT_SELECTION: AttributeValidationSelection = {
  datetime: {period: '14d', start: null, end: null, utc: false},
  projects: [],
};

describe('useAttributeValidation', () => {
  const organization = OrganizationFixture({slug: ORG_SLUG});

  it('returns empty invalidFilterKeys for empty query', () => {
    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS, '', DEFAULT_SELECTION),
      {organization}
    );

    expect(result.current.invalidFilterKeys).toEqual([]);
  });

  it('does not call the API when query has no filter keys', () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {}},
    });

    renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS, '', DEFAULT_SELECTION),
      {organization}
    );

    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('sets invalidFilterKeys for keys the API reports as invalid', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {
        attributes: {
          'span.op': {valid: true},
          unknown_key: {valid: false, error: 'Unknown attribute'},
        },
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useAttributeValidation(
          TraceItemDataset.SPANS,
          'span.op:db unknown_key:value',
          DEFAULT_SELECTION
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual(['unknown_key']);
    });
  });

  it('clears invalidFilterKeys when all keys become valid', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result} = renderHookWithProviders(
      () =>
        useAttributeValidation(TraceItemDataset.SPANS, 'span.op:db', DEFAULT_SELECTION),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });
  });

  it('skips validation when keys and selection are unchanged', async () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result, rerender} = renderHookWithProviders(
      ({query, selection}: {query: string; selection: AttributeValidationSelection}) =>
        useAttributeValidation(TraceItemDataset.SPANS, query, selection),
      {
        organization,
        initialProps: {query: 'span.op:db', selection: DEFAULT_SELECTION},
      }
    );

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });

    rerender({query: 'span.op:web', selection: DEFAULT_SELECTION});

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });

    expect(mockValidate).toHaveBeenCalledTimes(1);
  });

  it('re-validates when selection changes', async () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result, rerender} = renderHookWithProviders(
      ({query, selection}: {query: string; selection: AttributeValidationSelection}) =>
        useAttributeValidation(TraceItemDataset.SPANS, query, selection),
      {
        organization,
        initialProps: {query: 'span.op:db', selection: DEFAULT_SELECTION},
      }
    );

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });

    rerender({
      query: 'span.op:db',
      selection: {
        datetime: {period: '7d', start: null, end: null, utc: false},
        projects: [],
      },
    });

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledTimes(2);
    });
  });
});
