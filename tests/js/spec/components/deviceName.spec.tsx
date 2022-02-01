import * as Sentry from '@sentry/react';
import {generationByIdentifier} from 'ios-device-list';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as Device from 'sentry/components/deviceName';

jest.mock('ios-device-list');

describe('DeviceName', () => {
  it('renders device name if module is loaded', async () => {
    generationByIdentifier.mockImplementation(() => 'iPhone 6s Plus');

    render(<Device.DeviceName value="iPhone8,2" />);

    expect(await screen.findByText('iPhone 6s Plus')).toBeInTheDocument();
    expect(generationByIdentifier).toHaveBeenCalledWith('iPhone8,2');
  });

  it('renders device name if name helper returns undefined', async () => {
    generationByIdentifier.mockImplementation(() => undefined);

    render(<Device.DeviceName value="iPhone8,2" />);

    expect(await screen.findByText('iPhone8,2')).toBeInTheDocument();
    expect(generationByIdentifier).toHaveBeenCalledWith('iPhone8,2');
  });

  it('renders device name if module fails to load', async () => {
    jest.spyOn(Device, 'loadiOSDeviceListModule').mockImplementation(() => {
      return Promise.reject('Cannot load module');
    });

    const spy = jest.spyOn(Sentry, 'captureException');

    render(<Device.DeviceName value="iPhone8,2" />);

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('Failed to load ios-device-list module')
    );

    expect(await screen.findByText('iPhone8,2')).toBeInTheDocument();
  });
});
