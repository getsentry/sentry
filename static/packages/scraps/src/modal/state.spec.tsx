import {
  closeModal,
  isModalOpen,
  openModal,
  subscribeToModalOpen,
} from '@sentry/scraps/modal';

afterEach(() => closeModal());

it('notifies observers only when the modal opens or closes', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeToModalOpen(listener);
  expect(isModalOpen()).toBe(false);
  expect(listener).not.toHaveBeenCalled();
  openModal(() => null);
  expect(isModalOpen()).toBe(true);
  openModal(() => null);
  closeModal();
  closeModal();
  expect(listener.mock.calls).toEqual([[true], [false]]);
  unsubscribe();
  openModal(() => null);
  expect(listener).toHaveBeenCalledTimes(2);
});

it('does not call onClose for an imperative close or replacement', () => {
  const onClose = jest.fn();
  openModal(() => null, {onClose});
  openModal(() => null);
  closeModal();
  expect(onClose).not.toHaveBeenCalled();
});
