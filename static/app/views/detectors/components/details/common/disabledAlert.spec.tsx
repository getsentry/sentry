import {UptimeDetectorFixture} from 'sentry-fixture/detectors';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisabledAlert} from './disabledAlert';

describe('DisabledAlert', () => {
  it('does not render when detector is enabled', () => {
    const detector = UptimeDetectorFixture({enabled: true});

    const {container} = render(
      <DisabledAlert detector={detector} message="Test disabled message" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders alert with message and enable button when detector is disabled', () => {
    const detector = UptimeDetectorFixture({enabled: false});

    render(<DisabledAlert detector={detector} message="Test disabled message" />);

    expect(screen.getByText('Test disabled message')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('enables detector when enable button is clicked', async () => {
    const detector = UptimeDetectorFixture({id: '123', enabled: false});

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/123/',
      method: 'PUT',
      body: {...detector, enabled: true},
    });

    render(<DisabledAlert detector={detector} message="Test message" />);

    const enableButton = screen.getByRole('button', {name: 'Enable'});
    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {detectorId: '123', enabled: true},
        })
      );
    });
  });

  it('button is clickable when detector is disabled', () => {
    const detector = UptimeDetectorFixture({id: '123', enabled: false});

    render(<DisabledAlert detector={detector} message="Test message" />);

    const enableButton = screen.getByRole('button', {name: 'Enable'});
    expect(enableButton).toBeEnabled();
  });
});
