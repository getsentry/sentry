import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Banner} from 'sentry/components/banner';

describe('Banner', () => {
  it('can be dismissed', async () => {
    render(<Banner dismissKey="test" title="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
    expect(localStorage.getItem('test-banner-dismissed')).toBe('true');
  });

  it('does not render a Close button when isDismissable is false', () => {
    render(<Banner isDismissable={false} />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });
});
