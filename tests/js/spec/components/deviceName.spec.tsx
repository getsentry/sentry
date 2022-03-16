import * as Sentry from '@sentry/react';
import * as deviceList from 'ios-device-list';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {DeviceName} from 'sentry/components/deviceName';
import * as loadDeviceListModule from 'sentry/utils/loadDeviceListModule';

jest.mock('ios-device-list');

describe('DeviceName', () => {
  it('renders device name if module is loaded', async () => {
    const generationMock = jest.fn().mockImplementation(() => 'iPhone 6s Plus');
    jest.spyOn(loadDeviceListModule, 'loadDeviceListModule').mockImplementation(() => {
      return Promise.resolve({
        ...deviceList,
        generationByIdentifier: generationMock,
      });
    });

    render(<DeviceName value="iPhone8,2" />);

    await waitFor(() => expect(generationMock).toHaveBeenCalledWith('iPhone8,2'), {
      timeout: 5000,
    });
    expect(await screen.findByText('iPhone 6s Plus')).toBeInTheDocument();
  });

  it('renders device name if name helper returns undefined', async () => {
    const generationMock = jest.fn().mockImplementation(() => undefined);
    jest.spyOn(loadDeviceListModule, 'loadDeviceListModule').mockImplementation(() => {
      return Promise.resolve({
        ...deviceList,
        generationByIdentifier: generationMock,
      });
    });

    render(<DeviceName value="iPhone8,2" />);

    expect(await screen.findByText('iPhone8,2')).toBeInTheDocument();
    expect(generationMock).toHaveBeenCalledWith('iPhone8,2');
  });

  it('renders device name if module fails to load', async () => {
    jest.spyOn(loadDeviceListModule, 'loadDeviceListModule').mockImplementation(() => {
      return Promise.reject('Cannot load module');
    });

    const spy = jest.spyOn(Sentry, 'captureException');

    render(<DeviceName value="iPhone8,2" />);

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('Failed to load ios-device-list module')
    );

    expect(await screen.findByText('iPhone8,2')).toBeInTheDocument();
  });
});
