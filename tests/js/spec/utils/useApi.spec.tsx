import {renderHook} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import useApi from 'sentry/utils/useApi';

describe('useApi', function () {
  it('provides an api client ', function () {
    const {result} = renderHook(() => useApi());

    expect(result.current).toBeInstanceOf(Client);
  });

  it('cancels pending API requests when unmounted', function () {
    const {result, unmount} = renderHook(() => useApi());

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).toHaveBeenCalled();
  });

  it('does not cancel inflights when persistInFlight is true', function () {
    const {result, unmount} = renderHook(() => useApi({persistInFlight: true}));

    jest.spyOn(result.current, 'clear');
    unmount();

    expect(result.current.clear).not.toHaveBeenCalled();
  });

  it('uses pass through API when provided', function () {
    const myClient = new Client();
    const {unmount} = renderHook(() => useApi({api: myClient}));

    jest.spyOn(myClient, 'clear');
    unmount();

    expect(myClient.clear).toHaveBeenCalled();
  });
});
