import {createMemoryRouter, RouterProvider} from 'react-router-dom';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useCreateSummaryFilterLink} from 'sentry/components/codecov/summary';

function createWrapper(initialEntries: string) {
  return function Wrapper({children}: any) {
    const memoryRouter = createMemoryRouter([{path: '/', element: children}], {
      initialEntries: [initialEntries],
    });

    return <RouterProvider router={memoryRouter} />;
  };
}

describe('useCreateSummaryFilterLink', () => {
  describe('when the filter is not applied', () => {
    it('returns isFiltered as false', () => {
      const {result} = renderHook(() => useCreateSummaryFilterLink('test_type'), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.isFiltered).toBeFalsy();
    });

    it('returns the link with search param', () => {
      const {result} = renderHook(() => useCreateSummaryFilterLink('test_type'), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.filterLink).toEqual(
        expect.objectContaining({query: {f_b_type: 'test_type'}})
      );
    });
  });

  describe('when the filter is applied', () => {
    it('returns isFiltered as true', () => {
      const {result} = renderHook(() => useCreateSummaryFilterLink('test_type'), {
        wrapper: createWrapper('/?f_b_type=test_type'),
      });

      expect(result.current.isFiltered).toBeTruthy();
    });

    it('returns the link without search param', () => {
      const {result} = renderHook(() => useCreateSummaryFilterLink('test_type'), {
        wrapper: createWrapper('/?f_b_type=test_type'),
      });

      expect(result.current.filterLink).toEqual(expect.objectContaining({query: {}}));
    });
  });
});
