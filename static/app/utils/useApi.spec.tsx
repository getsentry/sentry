import {renderHook} from 'sentry-test/reactTestingLibrary';

import useApi from 'sentry/utils/useApi';

describe('useApi', () => {
  it('provides an api client', () => {
    const {result} = renderHook(useApi);

    expect(result.current).toBeInstanceOf(MockApiClient);
  });

  it('cancels pending API requests when unmounted', () => {
    const {result, unmount} = renderHook(useApi);

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).toHaveBeenCalled();
  });

  it('does not cancel inflights when persistInFlight is true', () => {
    const {result, unmount} = renderHook(useApi, {
      initialProps: {persistInFlight: true},
    });

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).not.toHaveBeenCalled();
  });

  it('uses pass through API when provided', () => {
    const myClient = new MockApiClient();
    const {unmount} = renderHook(useApi, {initialProps: {api: myClient}});

    jest.spyOn(myClient, 'clear');
    unmount();

    expect(myClient.clear).toHaveBeenCalled();
  });
});
