import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalModal from 'sentry/components/globalModal';

const mountedModals = [];

export async function mountGlobalModal(context) {
  const modal = mountWithTheme(<GlobalModal />, context);
  mountedModals.push(modal);
  await tick();
  modal.update();

  return modal;
}

afterEach(() => {
  while (mountedModals.length) {
    const modal = mountedModals.pop();
    if (modal.exists()) {
      // modal is still mounted
      modal.unmount();
    }
  }
});
