import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import ImportDashboardFromFileModal from 'sentry/components/modals/importDashboardFromFileModal';

function renderModal() {
  const closeModal = jest.fn();
  const result = render(
    <ImportDashboardFromFileModal
      Header={makeClosableHeader(closeModal)}
      Body={ModalBody}
      Footer={ModalFooter}
      CloseButton={makeCloseButton(closeModal)}
      closeModal={closeModal}
      organization={OrganizationFixture()}
    />
  );
  return {...result, closeModal};
}

function jsonFile(contents: unknown, name = 'dashboard.json') {
  return new File([JSON.stringify(contents)], name, {type: 'application/json'});
}

async function upload(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(input, file);
}

describe('ImportDashboardFromFileModal', () => {
  it('disables import until a file is selected', () => {
    renderModal();

    expect(screen.getByRole('button', {name: 'Import & Preview'})).toBeDisabled();
  });

  it('opens the imported dashboard as a preview', async () => {
    const {container, closeModal, router} = renderModal();

    await upload(
      container,
      jsonFile({
        version: 1,
        dashboard: {
          title: 'Imported',
          widgets: [{title: 'Widget', displayType: 'line', interval: '5m', queries: []}],
        },
      })
    );
    expect(screen.getByText('dashboard.json')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Import & Preview'}));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(router.location.pathname).toBe('/organizations/org-slug/dashboards/new/');
    expect(router.location.state.importedDashboard).toEqual(
      expect.objectContaining({
        title: 'Imported',
        widgets: [expect.objectContaining({title: 'Widget', layout: expect.any(Object)})],
      })
    );
  });

  it('shows why a file was rejected', async () => {
    const {container, closeModal} = renderModal();

    await upload(
      container,
      jsonFile({version: 99, dashboard: {title: 'Imported', widgets: []}})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Import & Preview'}));

    expect(await screen.findByText(/Unsupported export version: 99/)).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
