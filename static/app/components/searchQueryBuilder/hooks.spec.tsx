import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';

describe('useCaseSensitivity', () => {
  it('should return the correct case sensitivity', () => {
    const {result: noCaseSensitivity} = renderHookWithProviders(() =>
      useCaseInsensitivity()
    );
    expect(noCaseSensitivity.current[0]).toBeUndefined();

    const {result: caseSensitivityFalse} = renderHookWithProviders(
      () => useCaseInsensitivity(),
      {
        initialRouterConfig: {
          location: {pathname: '/', query: {caseInsensitive: 'false'}},
        },
      }
    );
    expect(caseSensitivityFalse.current[0]).toBe(false);

    const {result: caseSensitivityTrue} = renderHookWithProviders(
      () => useCaseInsensitivity(),
      {initialRouterConfig: {location: {pathname: '/', query: {caseInsensitive: 'true'}}}}
    );
    expect(caseSensitivityTrue.current[0]).toBe(true);
  });

  it('should set the case sensitivity', async () => {
    const {router, result} = renderHookWithProviders(() => useCaseInsensitivity());

    expect(router.location.query.caseInsensitive).toBeUndefined();

    const [, setCaseSensitivity] = result.current;

    act(() => setCaseSensitivity(true));
    await waitFor(() => expect(router.location.query.caseInsensitive).toBe('true'));

    act(() => setCaseSensitivity(false));
    await waitFor(() => expect(router.location.query.caseInsensitive).toBe('false'));
  });
});
