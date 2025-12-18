import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';

describe('useCaseSensitivity', () => {
  it('should return the correct case sensitivity', () => {
    const {result: noCaseSensitivity} = renderHookWithProviders(() =>
      useCaseInsensitivity()
    );
    expect(noCaseSensitivity.current[0]).toBeNull();

    const {result: caseSensitivityFalse} = renderHookWithProviders(
      () => useCaseInsensitivity(),
      {
        initialRouterConfig: {
          location: {pathname: '/', query: {}},
        },
      }
    );
    expect(caseSensitivityFalse.current[0]).toBeNull();

    const {result: caseSensitivityTrue} = renderHookWithProviders(
      () => useCaseInsensitivity(),
      {initialRouterConfig: {location: {pathname: '/', query: {caseInsensitive: '1'}}}}
    );
    expect(caseSensitivityTrue.current[0]).toBe(true);
  });

  it('should set the case sensitivity', async () => {
    const {router, result} = renderHookWithProviders(() => useCaseInsensitivity());

    expect(router.location.query.caseInsensitive).toBeUndefined();

    const [, setCaseSensitivity] = result.current;

    await act(() => setCaseSensitivity(true));
    await waitFor(() => expect(router.location.query.caseInsensitive).toBe('1'));

    await act(() => setCaseSensitivity(null));
    await waitFor(() => expect(router.location.query.caseInsensitive).toBeUndefined());
  });
});
