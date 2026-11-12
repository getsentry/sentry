import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from '@sentry/scraps/modal';

import {RestartAutofixModal} from './restartAutofixModal';

describe('RestartAutofixModal', () => {
  it('starts over only once the user says what to change', async () => {
    const onRestart = jest.fn();
    renderGlobalModal();
    act(() => {
      openModal(deps => <RestartAutofixModal {...deps} onRestart={onRestart} />);
    });

    const start = await screen.findByRole('button', {name: 'Start new analysis'});
    expect(start).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'Look at the cache layer');
    await userEvent.click(start);

    expect(onRestart).toHaveBeenCalledWith('Look at the cache layer');
  });
});
