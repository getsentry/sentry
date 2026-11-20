import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ClockDriftTag} from './clockDriftIndicators';

describe('ClockDriftTag', () => {
  it('renders nothing for a span that was not shifted', () => {
    const {container} = render(<ClockDriftTag offsetMs={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains a shift to a later time', async () => {
    render(<ClockDriftTag offsetMs={2000} />);

    await userEvent.hover(screen.getByText('Shifted +2.00s'));

    expect(
      await screen.findByText(
        "Shown 2.00s later in the waterfall to correct for clock drift: the clocks of the services in this trace were out of sync. The span's duration and the timestamps below are unchanged."
      )
    ).toBeInTheDocument();
  });

  it('explains a shift to an earlier time', async () => {
    render(<ClockDriftTag offsetMs={-340} />);

    await userEvent.hover(screen.getByText('Shifted −340.00ms'));

    expect(
      await screen.findByText(/^Shown 340.00ms earlier in the waterfall/)
    ).toBeInTheDocument();
  });
});
