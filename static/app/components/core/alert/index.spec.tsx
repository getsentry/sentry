import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Alert} from 'sentry/components/core/alert';

describe('Alert', () => {
  it('does not render icon by default', () => {
    render(<Alert type="info">Hello</Alert>);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('renders icon when showIcon is true', () => {
    render(
      <Alert type="info" showIcon>
        Hello
      </Alert>
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  describe('expandable', () => {
    it('does not render expand text by default', async () => {
      render(
        <Alert type="info" expand={<div>More stuff here</div>}>
          Hello
        </Alert>
      );

      expect(screen.queryByText('More stuff here')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
      expect(screen.getByText('More stuff here')).toBeInTheDocument();
    });

    it('renders expand text when defaultExpanded is true', () => {
      render(
        <Alert type="info" defaultExpanded expand={<div>More stuff here</div>}>
          Hello
        </Alert>
      );

      expect(screen.getByText('More stuff here')).toBeInTheDocument();
    });
  });
});
