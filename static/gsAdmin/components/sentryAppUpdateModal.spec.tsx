import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {ModalStore} from 'sentry/stores/modalStore';

import {SentryAppUpdateModal} from 'admin/components/sentryAppUpdateModal';

describe('SentryAppUpdateModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('updates popularity and features', async () => {
    MockApiClient.addMockResponse({
      url: '/integration-features/',
      body: [
        {featureId: 1, featureGate: 'integrations-alert-rule', description: ''},
        {featureId: 2, featureGate: 'integrations-issue-basic', description: ''},
      ],
    });
    const updateMock = MockApiClient.addMockResponse({
      url: '/sentry-apps/example-app/',
      method: 'PUT',
      body: {},
    });

    openModal(deps => (
      <SentryAppUpdateModal
        {...deps}
        sentryAppData={{
          slug: 'example-app',
          popularity: 10,
          featureData: [{featureId: 1}],
        }}
      />
    ));
    const {waitForModalToHide} = renderGlobalModal();

    const popularity = await screen.findByRole('spinbutton', {
      name: 'New popularity',
    });
    await userEvent.clear(popularity);
    await userEvent.type(popularity, '20');
    await userEvent.click(screen.getByRole('textbox', {name: 'Features'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'issue-basic'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitForModalToHide();
    expect(updateMock).toHaveBeenCalledWith(
      '/sentry-apps/example-app/',
      expect.objectContaining({
        method: 'PUT',
        data: expect.objectContaining({popularity: 20, features: [1, 2]}),
      })
    );
  });
});
