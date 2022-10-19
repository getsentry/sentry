import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import IgnoreActions from 'sentry/components/actions/ignore';

describe('IgnoreActions', function () {
  const spy = jest.fn();
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('disabled', function () {
    it('does not call onUpdate when clicked', function () {
      render(<IgnoreActions onUpdate={spy} disabled />);
      const button = screen.getByRole('button', {name: 'Ignore'});
      expect(button).toBeDisabled();
      userEvent.click(button);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('ignored', function () {
    it('displays ignored view', function () {
      render(<IgnoreActions onUpdate={spy} isIgnored />);
      const button = screen.getByRole('button', {name: 'Unignore'});
      expect(button).toBeInTheDocument();
      // Shows icon only
      expect(button).toHaveTextContent('');

      userEvent.click(button);
      expect(spy).toHaveBeenCalledWith({status: 'unresolved', statusDetails: {}});
    });
  });

  describe('without confirmation', function () {
    it('calls spy with ignore details when clicked', function () {
      render(<IgnoreActions onUpdate={spy} />);
      const button = screen.getByRole('button', {name: 'Ignore'});
      userEvent.click(button);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({status: 'ignored', statusDetails: {}});
    });
  });

  describe('with confirmation step', function () {
    it('displays confirmation modal with message provided', function () {
      render(
        <IgnoreActions onUpdate={spy} shouldConfirm confirmMessage={() => 'confirm me'} />
      );
      renderGlobalModal();
      const button = screen.getByRole('button', {name: 'Ignore'});
      userEvent.click(button);

      expect(screen.getByText('confirm me')).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
      userEvent.click(screen.getByTestId('confirm-button'));

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('custom', function () {
    it('can ignore until a custom date/time', function () {
      render(
        <IgnoreActions onUpdate={spy} shouldConfirm confirmMessage={() => 'confirm me'} />
      );
      renderGlobalModal();

      userEvent.click(screen.getByRole('button', {name: 'Ignore options'}));
      userEvent.hover(screen.getByRole('menuitemradio', {name: 'For…'}));
      userEvent.click(screen.getByRole('menuitemradio', {name: /Custom/}));

      // opens modal
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {name: 'Ignore'})
      );

      expect(spy).toHaveBeenCalledWith({
        status: 'ignored',
        statusDetails: {
          ignoreDuration: expect.any(Number),
        },
      });
    });
  });
});
