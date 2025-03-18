import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useDismissAlert from 'sentry/utils/useDismissAlert';

import {SampleDataAlert} from './sampleDataAlert';

vi.mock('sentry/utils/useDismissAlert');

const mockUseDismissAlert = vi.mocked(useDismissAlert);

describe('SampleDataAlert', function () {
  it('renders if not dismissed', async function () {
    const dismiss = vi.fn();
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
        dismiss: vi.fn(),
        isDismissed: true,
      };
    });

    const {container} = render(<SampleDataAlert />);
    expect(container).toBeEmptyDOMElement();
  });

  it("doesn't render when there's no dynamic sampling", function () {
    const dismiss = vi.fn();
    mockUseDismissAlert.mockImplementation(() => {
      return {
        dismiss,
        isDismissed: false,
      };
    });
    const {container} = render(<SampleDataAlert />, {
      organization: {...OrganizationFixture(), isDynamicallySampled: false},
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("doesn't render when event.type:error", function () {
    const dismiss = vi.fn();
    mockUseDismissAlert.mockImplementation(() => {
      return {
        dismiss,
        isDismissed: false,
      };
    });
    const {container} = render(<SampleDataAlert query="event.type:error" />);

    expect(container).toBeEmptyDOMElement();
  });
});
