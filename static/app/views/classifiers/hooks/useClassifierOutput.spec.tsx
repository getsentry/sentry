import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {useClassifierOutput} from './useClassifierOutput';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';

function renderOutput(
  classifier: TelemetryClassifier,
  query: Record<string, string> = {}
) {
  return renderHookWithProviders(() => useClassifierOutput(classifier), {
    initialRouterConfig: {location: {pathname: '/classifiers/1/', query}},
  });
}

describe('useClassifierOutput', () => {
  it('shows every result for classifiers without an output type', () => {
    const {result} = renderOutput(TelemetryClassifierFixture({outputType: null}), {
      results: 'matches',
    });

    expect(result.current.filter).toBe('all');
    expect(result.current.resultQuery).toBe(`has:${RESULT_FIELD}`);
  });

  it('shows every result for binary classifiers without a threshold', () => {
    const {result} = renderOutput(TelemetryClassifierFixture({binaryThreshold: null}));

    expect(result.current.filter).toBe('all');
    expect(result.current.resultQuery).toBe(`has:${RESULT_FIELD}`);
  });

  it('shows binary matches by default', () => {
    const {result} = renderOutput(TelemetryClassifierFixture());

    expect(result.current.filter).toBe('matches');
    expect(result.current.resultQuery).toBe(`${RESULT_FIELD}:>=0.8`);
  });

  it('reads the binary filter from the URL', () => {
    const {result} = renderOutput(TelemetryClassifierFixture(), {results: 'non-matches'});

    expect(result.current.resultQuery).toBe(`${RESULT_FIELD}:<0.8`);
  });

  it('falls back to the default binary filter for unknown URL values', () => {
    const {result} = renderOutput(TelemetryClassifierFixture(), {results: 'unknown'});

    expect(result.current.filter).toBe('matches');
  });

  it('writes the selected binary filter to the URL', async () => {
    const {result, router} = renderOutput(TelemetryClassifierFixture());

    act(() => result.current.setFilter('all'));

    await waitFor(() => expect(router.location.query.results).toBe('all'));
    expect(result.current.resultQuery).toBe(`has:${RESULT_FIELD}`);
  });
});
