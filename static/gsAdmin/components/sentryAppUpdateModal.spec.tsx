import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {ModalStore} from 'sentry/stores/modalStore';

import {SentryAppUpdateModal} from 'admin/components/sentryAppUpdateModal';

const featureData = [
  {featureId: 1, featureGate: 'integrations-alert-rule', description: ''},
  {featureId: 2, featureGate: 'integrations-issue-basic', description: ''},
];

function openSentryAppUpdateModal() {
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
  return renderGlobalModal();
}

describe('SentryAppUpdateModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('updates popularity and features', async () => {
    MockApiClient.addMockResponse({
      url: '/integration-features/',
      body: featureData,
    });
    const updateMock = MockApiClient.addMockResponse({
      url: '/sentry-apps/example-app/',
      method: 'PUT',
      body: {},
    });

    const {waitForModalToHide} = openSentryAppUpdateModal();

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

  it.each([
    ['empty', ''],
    ['below the minimum', '-1'],
    ['above the maximum', '32768'],
  ])('does not submit when popularity is %s', async (_description, value) => {
    MockApiClient.addMockResponse({url: '/integration-features/', body: featureData});
    const updateMock = MockApiClient.addMockResponse({
      url: '/sentry-apps/example-app/',
      method: 'PUT',
      body: {},
    });
    openSentryAppUpdateModal();

    const popularity = await screen.findByRole('spinbutton', {
      name: 'New popularity',
    });
    await userEvent.clear(popularity);
    if (value) {
      await userEvent.type(popularity, value);
    }
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows field errors returned by the API', async () => {
    MockApiClient.addMockResponse({url: '/integration-features/', body: featureData});
    MockApiClient.addMockResponse({
      url: '/sentry-apps/example-app/',
      method: 'PUT',
      statusCode: 400,
      body: {popularity: ['Popularity is unavailable']},
    });
    openSentryAppUpdateModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Popularity is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('retries loading feature options', async () => {
    MockApiClient.addMockResponse({
      url: '/integration-features/',
      statusCode: 500,
    });
    openSentryAppUpdateModal();

    const retryButton = await screen.findByRole('button', {name: 'Retry'});
    MockApiClient.addMockResponse({url: '/integration-features/', body: featureData});
    await userEvent.click(retryButton);

    expect(
      await screen.findByRole('spinbutton', {name: 'New popularity'})
    ).toBeInTheDocument();
  });
});
