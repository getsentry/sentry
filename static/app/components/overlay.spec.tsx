import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PositionWrapper} from 'sentry/components/overlay';

describe('PositionWrapper', () => {
  it('does not force pointer-events so css can disable them', () => {
    render(<PositionWrapper zIndex={1} data-test-id="position-wrapper" />);

    expect(screen.getByTestId('position-wrapper')).not.toHaveStyle({
      pointerEvents: 'auto',
    });
  });

  it('keeps pointer-events from the style prop', () => {
    render(
      <PositionWrapper
        zIndex={1}
        style={{pointerEvents: 'none'}}
        data-test-id="position-wrapper"
      />
    );

    expect(screen.getByTestId('position-wrapper')).toHaveStyle({pointerEvents: 'none'});
  });
});
