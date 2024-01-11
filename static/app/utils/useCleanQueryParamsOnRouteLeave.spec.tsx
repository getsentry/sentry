import {browserHistory} from 'react-router';
import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useCleanQueryParamsOnRouteLeave, {
  handleRouteLeave,
} from './useCleanQueryParamsOnRouteLeave';
import {useLocation} from './useLocation';

jest.mock('react-router');
jest.mock('./useLocation');

const MockBrowserHistoryListen = jest.mocked(browserHistory.listen);
const MockBrowserHistoryReplace = jest.mocked(browserHistory.replace);

jest.mocked(useLocation).mockReturnValue({pathname: '/home'} as Location);

type QueryParams = {cursor: string; limit: number; project: string};

describe('useCleanQueryParamsOnRouteLeave', () => {
  beforeEach(() => {
    MockBrowserHistoryListen.mockReset();
    MockBrowserHistoryReplace.mockReset();
  });

  it('should listen to browserHistory changes and stop on unmount', () => {
    const unsubscriber = jest.fn();
    MockBrowserHistoryListen.mockReturnValue(unsubscriber);

    const {unmount} = reactHooks.renderHook(useCleanQueryParamsOnRouteLeave, {
      initialProps: {
        fieldsToClean: ['cursor'],
      },
    });

    expect(MockBrowserHistoryListen).toHaveBeenCalled();
    expect(unsubscriber).not.toHaveBeenCalled();

    unmount();

    expect(unsubscriber).toHaveBeenCalled();
  });

  it('should not update the history if shouldLeave returns false', () => {
    MockBrowserHistoryListen.mockImplementation(onRouteLeave => {
      onRouteLeave(
        LocationFixture({
          pathname: '/next',
          query: {
            cursor: '0:1:0',
            limit: '5',
          },
        })
      );
      return () => {};
    });

    reactHooks.renderHook(useCleanQueryParamsOnRouteLeave, {
      initialProps: {
        fieldsToClean: ['cursor'],
        shouldClean: () => false,
      },
    });

    expect(MockBrowserHistoryReplace).not.toHaveBeenCalled();
  });

  it('should not update the history if the pathname is unchanged', () => {
    handleRouteLeave({
      fieldsToClean: ['cursor'],
      newLocation: {
        pathname: '/home',
        query: {},
      } as Location,
      oldPathname: '/home',
    });

    expect(MockBrowserHistoryReplace).not.toHaveBeenCalled();
  });

  it('should not update the history if the pathname is changing, but fieldsToClean are undefined', () => {
    handleRouteLeave({
      fieldsToClean: ['cursor'],
      newLocation: {
        pathname: '/next',
        query: {},
      } as Location,
      oldPathname: '/home',
    });

    expect(MockBrowserHistoryReplace).not.toHaveBeenCalled();
  });

  it('should update the history when the path is changing and some fieldsToClean are set', () => {
    handleRouteLeave({
      fieldsToClean: ['cursor', 'limit'],
      newLocation: {
        pathname: '/next',
        query: {
          cursor: '0:1:0',
          limit: 5,
        },
      } as Location<QueryParams>,
      oldPathname: '/home',
    });

    expect(MockBrowserHistoryReplace).toHaveBeenCalledWith({
      pathname: '/next',
      query: {},
    });
  });

  it('should leave other query params alone when the path is changing and something is filtered out', () => {
    handleRouteLeave({
      fieldsToClean: ['cursor', 'limit'],
      newLocation: {
        pathname: '/next',
        query: {
          cursor: '0:1:0',
          limit: 5,
          project: '123',
        },
      } as Location<QueryParams>,
      oldPathname: '/home',
    });

    expect(MockBrowserHistoryReplace).toHaveBeenCalledWith({
      pathname: '/next',
      query: {
        project: '123',
      },
    });
  });
});
