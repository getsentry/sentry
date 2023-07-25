import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useDismissAlert from 'sentry/utils/useDismissAlert';

import {SampleDataAlert} from './sampleDataAlert';

jest.mock('sentry/utils/useDismissAlert');

const mockUseDismissAlert = useDismissAlert as jest.MockedFunction<
  typeof useDismissAlert
>;

describe('SampleDataAlert', function () {
  it('renders if not dismissed', async function () {
    const dismiss = jest.fn();
    mockUseDismissAlert.mockImplementation(() => {
      return {
        dismiss,
        isDismissed: false,
      };
    });
    render(<SampleDataAlert />);
    expect(screen.getByText(/Based on your search criteria/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dismiss Alert'));
    expect(dismiss).toHaveBeenCalled();
  });

  it("doesn't render when dismissed", function () {
    mockUseDismissAlert.mockImplementation(() => {
      return {
        dismiss: jest.fn(),
        isDismissed: true,
      };
    });

    const {container} = render(<SampleDataAlert />);
    expect(container).toBeEmptyDOMElement();
  });
});
