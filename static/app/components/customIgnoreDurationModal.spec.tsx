import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {CustomIgnoreDurationModal} from './customIgnoreDurationModal';

function renderModal() {
  const closeModal = jest.fn();
  const onSelected = jest.fn();
  render(
    <CustomIgnoreDurationModal
      closeModal={closeModal}
      Body={ModalBody}
      Footer={ModalFooter}
      Header={makeClosableHeader(closeModal)}
      CloseButton={makeCloseButton(closeModal)}
      onSelected={onSelected}
    />
  );
  return {closeModal, onSelected};
}

describe('CustomIgnoreDurationModal', () => {
  it('archives for the minutes until the selected date', async () => {
    const {closeModal, onSelected} = renderModal();

    expect(screen.getByLabelText('Date')).toBeRequired();
    expect(screen.getByLabelText('Time (UTC)')).toBeRequired();

    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    expect(onSelected).toHaveBeenCalledWith({ignoreDuration: expect.any(Number)});
    expect(onSelected.mock.calls[0][0].ignoreDuration).toBeGreaterThan(0);
    expect(closeModal).toHaveBeenCalled();
  });

  it('warns when the selected date is in the past', async () => {
    const {closeModal, onSelected} = renderModal();

    const dateInput = screen.getByLabelText('Date');
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2000-01-01');

    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    expect(
      screen.getByText('Please enter a valid date in the future')
    ).toBeInTheDocument();
    expect(onSelected).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
