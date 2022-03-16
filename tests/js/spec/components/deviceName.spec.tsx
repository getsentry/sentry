import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DeviceName} from 'sentry/components/deviceName';

jest.mock('ios-device-list');

describe('DeviceName', () => {
  it('renders device name if module is loaded', async () => {
    render(<DeviceName value="iPhone8,2" />);
    expect(await screen.findByText('iPhone 6s Plus')).toBeInTheDocument();
  });

  it('renders device name if name helper returns undefined', async () => {
    render(<DeviceName value="iPhone8,2FunkyValue" />);

    expect(await screen.findByText('iPhone8,2FunkyValue')).toBeInTheDocument();
  });
});
