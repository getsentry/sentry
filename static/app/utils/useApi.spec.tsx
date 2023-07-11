import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useApi from 'sentry/utils/useApi';

describe('useApi', function () {
  it('provides an api client', function () {
    const {result} = reactHooks.renderHook(useApi);

    expect(result.current).toBeInstanceOf(MockApiClient);
  });

  it('cancels pending API requests when unmounted', function () {
    const {result, unmount} = reactHooks.renderHook(useApi);

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).toHaveBeenCalled();
  });

  it('does not cancel inflights when persistInFlight is true', function () {
    const {result, unmount} = reactHooks.renderHook(useApi, {
      initialProps: {persistInFlight: true},
    });

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).not.toHaveBeenCalled();
  });

  it('uses pass through API when provided', function () {
    const myClient = new MockApiClient();
    const {unmount} = reactHooks.renderHook(useApi, {initialProps: {api: myClient}});

    jest.spyOn(myClient, 'clear');
    unmount();

    expect(myClient.clear).toHaveBeenCalled();
  });
});
