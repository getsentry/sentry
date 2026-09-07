import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ModalStore} from 'sentry/stores/modalStore';

import {triggerGoogleDomainModal} from 'admin/components/changeGoogleDomainAction';

describe('ChangeGoogleDomainAction', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('runs a preview before changing the domain', async () => {
    const previewMock = MockApiClient.addMockResponse({
      url: '/customers/org-slug/migrate-google-domain/',
      method: 'POST',
      body: {dryrun_info: ['user@example.com will be updated']},
    });
    const onUpdated = jest.fn();

    triggerGoogleDomainModal({orgId: 'org-slug', onUpdated});
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.type(screen.getByRole('textbox', {name: 'New Domain'}), 'new.test');
    await userEvent.click(screen.getByRole('textbox', {name: 'Change Option'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Swap'}));
    await userEvent.click(screen.getByRole('button', {name: 'Do Dry Run'}));

    expect(
      await screen.findByText('user@example.com will be updated')
    ).toBeInTheDocument();
    expect(previewMock).toHaveBeenCalledWith(
      '/customers/org-slug/migrate-google-domain/',
      expect.objectContaining({
        method: 'POST',
        data: {append: 'swap', newDomain: 'new.test', dryRun: true},
      })
    );

    const updateMock = MockApiClient.addMockResponse({
      url: '/customers/org-slug/migrate-google-domain/',
      method: 'POST',
      body: {new_domain: 'new.test'},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Update Google Domain(s)'}));

    await waitForModalToHide();
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(onUpdated).toHaveBeenCalledWith({newDomain: 'new.test'});
  });
});
