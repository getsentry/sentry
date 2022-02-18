import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalModal from 'sentry/components/globalModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

const mountedModals = [];

export async function mountGlobalModal(context, organization) {
  const modal = mountWithTheme(
    <OrganizationContext.Provider value={organization}>
      <GlobalModal />
    </OrganizationContext.Provider>,
    context
  );
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
