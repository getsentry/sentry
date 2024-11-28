import {LocationFixture} from 'sentry-fixture/locationFixture';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTitle} from 'sentry/views/dashboards/widgetBuilder/hooks/useTitle';

jest.mock('sentry/utils/useLocation');

jest.mock('sentry/utils/useNavigate');

const mockedUsedLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useTitle', () => {
  it('returns the title from the query params', () => {
    mockedUsedLocation.mockReturnValue(LocationFixture({query: {title: 'test'}}));

    const {result} = renderHook(() => useTitle());

    expect(result.current[0]).toBe('test');
  });

  it('sets the new title in the query params', () => {
    const mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);

    const {result} = renderHook(() => useTitle());
    result.current[1]('new title');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: expect.objectContaining({title: 'new title'})})
    );
  });
});
