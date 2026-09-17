import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';

describe('Legacy indicators', () => {
  beforeEach(() => clearIndicators());

  it('replaces other indicator variants while preserving newer toasts', async () => {
    render(<div />);
    act(() => {
      toast.loading('Resolving issues', {duration: Infinity});
      addLoadingMessage('Saving changes', {duration: 0});
    });
    expect(await screen.findByText('Saving changes')).toBeInTheDocument();

    act(() => addSuccessMessage('Changes saved'));
    await waitForElementToBeRemoved(() => screen.queryByText('Saving changes'));
    expect(screen.getByText('Changes saved')).toBeInTheDocument();
    expect(screen.getByText('Resolving issues')).toBeInTheDocument();

    act(() => addSuccessMessage('Another change saved'));
    expect(await screen.findByText('Another change saved')).toBeInTheDocument();
    expect(screen.getByText('Changes saved')).toBeInTheDocument();

    act(() => clearIndicators());
    await waitForElementToBeRemoved(() => screen.queryByText('Changes saved'));
    expect(screen.queryByText('Another change saved')).not.toBeInTheDocument();
    expect(screen.getByText('Resolving issues')).toBeInTheDocument();
  });
});
